export default {
	copyName(baseName) {
		const name =
					String(
						baseName || "Event"
					).trim();

		const existingNames =
					(
						qryEvtGetNames.data ||
						[]
					)
		.map(row =>
				 String(
			row.name || ""
		).trim()
				)
		.filter(Boolean);

		const normalized =
					existingNames.map(name =>
														name.toLowerCase()
													 );

		let candidate =
				`${name} - copy`;

		let counter = 2;

		while (
			normalized.includes(
				candidate.toLowerCase()
			)
		) {
			candidate =
				`${name} - copy ${counter}`;

			counter += 1;
		}

		return candidate;
	},

	deepCopy(value) {
		return JSON.parse(
			JSON.stringify(value)
		);
	},

	meaningfulComponents(rows) {
		return (rows || [])
			.filter(row =>
							Number(
			row?.menu_id || 0
		) > 0 ||
							String(
			row?.menu_name || ""
		).trim()
						 );
	},

	async buildDuplicateSnapshot(
		useSavedHeader = false
	) {
		const sourceEventId =
					Number(
						appsmith.store.current_event_id || 0
					);

		if (!sourceEventId) {
			showAlert(
				"There is no saved Event to duplicate.",
				"warning"
			);

			return null;
		}

		/*
		 * Capture the LIVE Event Header.
		 */
		const sourceHeader =
					useSavedHeader
		? jsEvtWorkspace.savedEvent()
		: jsEvtWorkspace.current();

		await Promise.all([
			qryEvtGetAllPropMenus.run(),
			qryEvtGetNames.run()
		]);

		const proposalRows =
					qryEvtGetPropsForEvent.data || [];

		const menuRows =
					qryEvtGetAllPropMenus.data || [];

		const currentProposalId =
					Number(
						appsmith.store.current_proposal_id || 0
					);

		/*
		 * Only persisted Proposals are candidates.
		 *
		 * Never-saved temporary Proposals are not
		 * in qryGetProposalsForEvent and therefore
		 * are intentionally excluded.
		 */
		const proposalCopies =
					proposalRows
		.map(proposal => {


			const proposalId =
						Number(
							proposal.id || 0
						);

			const workspace =
						jsPropWorkspaces.get(
							proposalId
						);

			let components = [];

			/*
				 * Current Proposal:
				 * use exactly what is on screen.
				 */
			if (
				proposalId ===
				currentProposalId &&
				jsPropData
				.hasSelectedProposal()
			) {
				components =
					jsPropComponents
					.effectiveRows();
			}

			/*
				 * Previously visited Proposal:
				 * use its preserved Working State.
				 */
			else if (
				workspace &&
				Array.isArray(
					workspace.components
				)
			) {
				components =
					workspace.components;
			}

			/*
				 * Untouched Proposal:
				 * use saved database truth.
				 */
			else {
				components =
					menuRows.filter(row =>
													Number(
					row.proposal_id || 0
				) ===
													proposalId
												 );
			}

			return {
				proposalId,

				active:
				workspace?.active ??
				proposal.active !== false,

				components:
				this.meaningfulComponents(
					components
				)
			};
		})

		/*
			 * A Proposal that is blank in the
			 * current live state is not copied.
			 */
		.filter(item =>
						item.components.length > 0
					 )

		.map((item, index) => ({
			temp_proposal_no:
			index + 1,

			source_proposal_id:
			null,

			components:
			this.deepCopy(
				item.components.map(row => ({
					...row,

					/*
			 * A duplicated Event is a new occurrence.
			 *
			 * Historical cost basis belongs only to
			 * the source Event and must never cross
			 * the Event Duplicate boundary.
			 *
			 * With frozen_cost_per_unit cleared,
			 * jsProposalComponents.refreshDerivedFields()
			 * will use the Menu's current cost.
			 */
					frozen_cost_per_unit:
					null,

					menu_cost:
					null,

					line_cost:
					null,

					kitchen_cost:
					null
				}))
			)
		}));

		return {
			source_event_id:
			sourceEventId,

			header: {
				...this.deepCopy(
					sourceHeader
				),

				event_id:
				0,

				name:
				this.copyName(
					sourceHeader.name
				),

				closed:
				false,

				status:
				"Draft",

				active:
				true,

				closed_at:
				null,

				closed_proposal_id:
				null,
			},

			proposals:
			proposalCopies
		};
	},

	async stageDuplicateSnapshot(
		useSavedHeader = false
	) {
		const snapshot =
					await this.buildDuplicateSnapshot(
						useSavedHeader
					);

		if (!snapshot) {
			return false;
		}

		await storeValue(
			"event_duplicate_snapshot",
			snapshot
		);

		return true;
	},

	async openStagedDuplicate() {
		const snapshot =
					appsmith.store
		.event_duplicate_snapshot ||
					null;

		if (!snapshot) {
			showAlert(
				"Duplicate workspace could not be created.",
				"error"
			);

			return false;
		}

		/*
		 * Leave the source Event workspace.
		 */
		await removeValue(
			"current_proposal_id"
		);

		await removeValue(
			"proposal_workspaces"
		);

		/*
		 * Duplicate exists only in Appsmith
		 * until the user clicks Save.
		 */
		await storeValue(
			"current_event_id",
			0
		);

		await jsEvtWorkspace.set(
			snapshot.header
		);

		const createdIds =
					await jsPropWorkspaces
		.createTemporaryBatch(
			snapshot.proposals || []
		);

		await removeValue(
			"event_duplicate_snapshot"
		);

		await resetWidget(
			"tblEvtComponents",
			true
		);

		showAlert(
			"Event duplicated. Save to create it.",
			"success"
		);

		return {
			proposal_ids:
			createdIds
		};
	},

	async addNewEvent() {
		await storeValue(
			"event_name_mode",
			"add"
		);

		await resetWidget(
			"inpEvtRenameName",
			true
		);

		showModal(
			mdlEvtRename.name
		);

		return true;
	},

	async cancelEventName() {
		await resetWidget(
			"inpEvtRenameName",
			true
		);

		await removeValue(
			"event_name_mode"
		);

		closeModal(
			mdlEvtRename.name
		);

		return true;
	},

	async openDelete() {
		const eventId =
					Number(
						appsmith.store.current_event_id || 0
					);

		if (eventId <= 0) {
			showAlert(
				"No saved Event is selected.",
				"warning"
			);

			return false;
		}

		try {
			const result =
						await qryEvtGetDeleteImpact.run();

			const impact =
						result?.[0] || null;

			if (!impact) {
				throw new Error(
					"Event delete impact could not be checked."
				);
			}

			await storeValue(
				"evt_delete_impact",
				impact
			);

			showModal(
				mdlEvtDelete.name
			);

			return true;
		}
		catch (error) {
			showAlert(
				error?.message ||
				"Event delete impact could not be checked.",
				"error"
			);

			return false;
		}
	},

	async deleteEvent() {
		const eventId =
					Number(
						appsmith.store.current_event_id || 0
					);

		if (eventId <= 0) {
			closeModal(mdlEvtDelete.name);

			showAlert(
				"No saved Event is selected.",
				"warning"
			);

			return false;
		}

		try {
			const result =
						await qryEvtDeleteEvent.run();

			const row =
						result?.[0] || null;

			if (row?.deleted !== true) {
				throw new Error(
					"Event could not be deleted."
				);
			}

			await removeValue(
				"evt_delete_impact"
			);

			closeModal(mdlEvtDelete.name);

			showAlert(
				"Event deleted.",
				"success"
			);

			navigateTo(
				"EventList",
				{},
				"SAME_WINDOW"
			);

			return true;
		}
		catch (error) {
			showAlert(
				error?.message ||
				"Event could not be deleted.",
				"error"
			);

			return false;
		}
	},

	deleteImpactText() {
		const impact =
					appsmith.store.evt_delete_impact || {};

		if (impact.has_groceries_materialized !== true) {
			return "";
		}

		return (
			"Groceries, Details and Order will be updated to reflect the remaining Events. " +
			"Manually entered quantities will be kept for ingredients still required.<br><br>" +
			"Do you want to remove?"
		);
	},
};