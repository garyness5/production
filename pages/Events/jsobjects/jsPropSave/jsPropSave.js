export default {
	textClean(value) {
		const text =
					String(
						value ?? ""
					).trim();

		return text || null;
	},

	requiredMessage() {
		if (
			!jsPropData.hasSelectedProposal()
		) {
			return "No Proposal is currently selected.";
		}

		return null;
	},

	menuPayload(rows) {
		return (rows || [])
			.filter(row =>
							jsPropComponents
							.hasContent(row)
						 )
			.map((row, index) => {
			const derived =
						jsPropComponents
			.refreshDerivedFields(row);

			return {
				line_no:
				index + 1,

				menu_id:
				Number(
					derived.menu_id || 0
				) || null,

				category_id:
				Number(
					derived.category_id || 0
				) || null,

				category_name:
				this.textClean(
					derived.category_name
				),

				menu_name:
				this.textClean(
					derived.current_menu_name ||
					derived.menu_name
				),

				guests:
				derived.guests == null
				? null
				: Number(
					derived.guests
				),

				extra_guests:
				derived.extra_guests == null
				? 0
				: Number(
					derived.extra_guests
				),

				allergen_names:
				this.textClean(
					derived.allergen_names
				),

				diet_tag_names:
				this.textClean(
					derived.diet_tag_names
				),

				notes:
				this.textClean(
					derived.notes
				),

				active:
				derived.active === false
				? false
				: true
			};
		});
	},

	async refreshCurrentProposal(
		proposalId
	) {
		/*
	 * The Proposal has already been committed.
	 *
	 * Reload all Published State used by:
	 * - selected Proposal header
	 * - selected Proposal components
	 * - Event Proposal selector
	 *
	 * These queries are independent once
	 * current_proposal_id is established.
	 */
		await Promise.all([
			qryEvtGetSelectedProposal.run(),
			qryEvtGetSelectedPropMenus.run(),
			qryEvtGetPropsForEvent.run()
		]);

		/*
	 * The old workspace/baseline represented
	 * pre-save Working State.
	 */
		await jsPropWorkspaces
			.discard(
			proposalId
		);

		/*
	 * Rebuild the selected Proposal workspace
	 * from the newly saved Supabase truth.
	 */
		await jsPropWorkspaces
			.initializeCurrentWorkspace();

		await resetWidget(
			"tblEvtComponents",
			true
		);

		return true;
	},

	async saveExistingProposal(
		proposalId,
		rows
	) {
		const workspace =
					jsPropWorkspaces.get(proposalId);

		const request = {
			proposal_id:
			proposalId,

			active:
			workspace?.active !== false,

			menus:
			this.menuPayload(rows)
		};

		await storeValue(
			"proposal_save_request",
			request
		);

		try {
			const result =
						await qryEvtSaveProposal.run();

			const savedId =
						Number(
							result?.[0]
							?.proposal_id ||
							0
						);

			return savedId > 0
				? savedId
			: null;
		}
		finally {
			await removeValue(
				"proposal_save_request"
			);
		}
	},

	async saveNewProposal(
		tempProposalId,
		rows
	) {
		const workspace =
					jsPropWorkspaces
		.get(
			tempProposalId
		);

		if (!workspace) {
			return null;
		}

		const request = {
			proposal_id:
			tempProposalId,

			source_proposal_id:
			Number(
				workspace.source_proposal_id || 0
			) || null,

			active:
			workspace?.active !== false,

			menus:
			this.menuPayload(rows)
		};

		await storeValue(
			"proposal_save_request",
			request
		);

		try {
			const result =
						await qryEvtSaveNewEventProposal.run();

			const savedId =
						Number(
							result?.[0]
							?.proposal_id ||
							0
						);

			return savedId > 0
				? savedId
			: null;
		}
		finally {
			await removeValue(
				"proposal_save_request"
			);
		}
	},

	async ensureParentEvent() {
		const existingEventId =
					Number(
						appsmith.store
						.current_event_id ||
						0
					);

		/*
		 * Existing Event:
		 * Proposal Save must not save unrelated
		 * Event Header changes.
		 */
		if (existingEventId > 0) {
			return existingEventId;
		}

		/*
		 * New / duplicated Event:
		 * establish only the parent Event identity
		 * before the Proposal can be persisted.
		 */
		const eventId =
					await jsEvtSave
		.ensureEventSavedForProposal();

		if (eventId <= 0) {
			showAlert(
				"Proposal was not saved because the Event could not be created.",
				"error"
			);

			return 0;
		}

		/*
		 * Reload saved Proposal truth for the newly
		 * created Event.
		 *
		 * Other temporary Proposal workspaces remain
		 * untouched.
		 */
		await qryEvtGetPropsForEvent.run();

		return eventId;
	},

	async handleOrderedInactiveBeforeSave(
		proposalId
	) {
		const id =
					Number(
						proposalId || 0
					);

		if (id <= 0) {
			return true;
		}

		const workspace =
					jsPropWorkspaces.get(id);

		const savedProposal =
					(qryEvtGetPropsForEvent.data || [])
		.find(
			row =>
			Number(row.id) === id
		)
		||
					qryEvtGetSelectedProposal.data?.[0]
		||
					null;

		const becomingInactive =
					workspace?.active === false &&
					workspace?.saved_active !== false;

		const isOrdered =
					savedProposal?.proposal_status ===
					"Ordered";

		if (
			!becomingInactive ||
			!isOrdered
		) {
			return true;
		}

		await storeValue(
			"evt_gro_unorder_after_action",
			"save_proposal"
		);

		/*
	 * Existing Unorder owns:
	 * - Groceries impact check
	 * - direct removal when not exploded
	 * - mdlEvtUnorder when exploded
	 * - clearing Ordered
	 * - Groceries rebuild
	 */
		await jsPropActions.unorder(
			proposalId
		);

		return false;
	},

	async saveProposal() {
		const message =
					this.requiredMessage();

		if (message) {
			showAlert(
				message,
				"warning"
			);

			return false;
		}

		/*
		 * Capture the Proposal identity before a
		 * temporary parent Event receives its
		 * persistent identity.
		 */
		const proposalId =
					Number(
						appsmith.store
						.current_proposal_id ||
						0
					);

		if (!proposalId) {
			showAlert(
				"Proposal was not saved.",
				"error"
			);

			return false;
		}

		const canContinue =
					await this
		.handleOrderedInactiveBeforeSave(
			proposalId
		);

		if (!canContinue) {
			return false;
		}

		const rows =
					jsPropComponents
		.effectiveRows();

		/*
		 * Proposal cannot exist in Supabase until
		 * its parent Event has a real identity.
		 *
		 * This creates only the parent Event when
		 * necessary. It does not perform Event Save.
		 */
		const eventId =
					await this
		.ensureParentEvent();

		if (eventId <= 0) {
			return false;
		}

		let savedId = null;

		/*
		 * Existing persisted Proposal.
		 */
		if (proposalId > 0) {
			savedId =
				await this
				.saveExistingProposal(
				proposalId,
				rows
			);

			if (!savedId) {
				showAlert(
					"Proposal was not saved.",
					"error"
				);

				return false;
			}

			await this
				.refreshCurrentProposal(
				savedId
			);
		}

		/*
		 * Temporary never-saved Proposal.
		 */
		else {
			savedId =
				await this
				.saveNewProposal(
				proposalId,
				rows
			);

			if (!savedId) {
				showAlert(
					"Proposal was not saved.",
					"error"
				);

				return false;
			}

			/*
			 * Remove only the temporary workspace
			 * that has now been persisted.
			 *
			 * Other temporary Proposals remain
			 * exactly as the user left them.
			 */
			await jsPropWorkspaces
				.discard(
				proposalId
			);

			/*
			 * Current Proposal now uses its real
			 * persistent Supabase identity.
			 */
			await storeValue(
				"current_proposal_id",
				savedId
			);

			/*
			 * Load the saved Proposal as the new
			 * Published + Working State.
			 */
			await this
				.refreshCurrentProposal(
				savedId
			);

			/*
			 * Renumber any remaining temporary
			 * duplicated Draft labels now that this
			 * Proposal received its real number.
			 */
			await jsPropWorkspaces
				.renumberTemporaryDrafts();
		}

		showAlert(
			"Proposal saved.",
			"success"
		);

		return true;
	}
};