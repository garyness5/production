export default {
	async dirtyState() {
		return {
			event_dirty:
			jsEvtSave.isDirty(),

			proposal_ids:
			jsPropWorkspaces
			.dirtyProposalIds()
		};
	},

	proposalLabel(proposalId) {
		const id =
					Number(
						proposalId || 0
					);

		const row =
					(
						qryEvtGetPropsForEvent.data ||
						[]
					)
		.find(item =>
					Number(
			item.id || 0
		) === id
				 );

		if (row?.proposal_no != null) {
			return `Proposal ${row.proposal_no}`;
		}

		const workspace =
					jsPropWorkspaces.get(id);

		if (
			id < 0 &&
			workspace?.temp_proposal_no != null
		) {
			return `Draft ${workspace.temp_proposal_no}`;
		}

		return "New Proposal";
	},

	actionTitle(action) {
		switch (action) {
			case "duplicate":
				return "Duplicate Event";

			case "close":
				return "Close Event";

			case "delete":
				return "Delete Event";

			default:
				return "Unsaved Changes";
		}
	},

	actionMessage(state) {
		const proposalIds =
					state?.proposal_ids || [];

		const proposalList =
					proposalIds
		.map(id =>
				 `• ${this.proposalLabel(id)}`
				)
		.join("\n");

		const parts = [
			"This Event has unsaved changes.",
			"",
			"Save — save all Event and Proposal changes, then continue.",
			"",
			"Discard — discard all unsaved changes and revert to the last saved state. Any Proposal that has never been saved will be deleted.",
			"",
			"Cancel — return without doing anything."
		];

		if (proposalIds.length) {
			parts.push(
				"",
				`Unsaved Proposals (${proposalIds.length}):`,
				proposalList
			);
		}

		return parts.join("\n");
	},

	async request(action) {
		/*
		 * Capture the visible Event Header first.
		 * This preserves whatever is currently
		 * on screen before any action decision.
		 */
		await jsEvtWorkspace.capture();

		/*
		 * Duplicate needs its snapshot staged
		 * before any Save / Discard decision.
		 */
		if (action === "duplicate") {
			const staged =
						await jsEvtActions
			.stageDuplicateSnapshot();

			if (!staged) {
				return false;
			}
		}

		/*
		 * Event Save has its own confirmation modal.
		 *
		 * Save means:
		 * save the complete Event + Proposal state.
		 */
		if (action === "save") {
			return await this
				.saveAndReload();
		}

		/*
		 * Read current dirty state.
		 */
		const eventDirty =
					jsEvtSave.isDirty();

		const proposalIds =
					jsPropWorkspaces
		.dirtyProposalIds();

		const state = {
			event_dirty:
			eventDirty,

			proposal_ids:
			proposalIds
		};

		/*
		 * Other guarded Event actions.
		 *
		 * Any Event or Proposal dirty state must
		 * go through Save / Discard / Cancel.
		 */
		if (
			eventDirty ||
			proposalIds.length
		) {
			await storeValue(
				"pendingEventAction",
				action
			);

			await storeValue(
				"evt_unsaved_title",
				this.actionTitle(
					action
				)
			);

			await storeValue(
				"evt_unsaved_message",
				this.actionMessage(
					state
				)
			);

			showModal(
				mdlEvtUnsavedChanges.name
			);

			return false;
		}

		return await this
			.executeWithoutWarning(
			action
		);
	},

	async executeWithoutWarning(action) {
		switch (action) {
			case "duplicate":
				return await jsEvtActions
					.openStagedDuplicate();

			case "close":
				navigateTo(
					"EventList",
					{},
					"SAME_WINDOW"
				);

				return true;

			case "navigate": {
				const target =
							String(
								appsmith.store
								.pendingEventNavigationTarget ||
								""
							).trim();

				if (!target) {
					return false;
				}

				await removeValue(
					"pendingEventNavigationTarget"
				);

				navigateTo(
					target,
					{},
					"SAME_WINDOW"
				);

				return true;
			}

			default:
				return false;
		}
	},

	orderedProposal() {
		return (
			(qryEvtGetPropsForEvent.data || [])
			.find(row =>
						row?.proposal_status === "Ordered"
					 ) ||
			null
		);
	},

	async handleInactiveOrderedBeforeSave() {
		/*
	 * FIRST:
	 * Check dirty saved Proposal workspaces.
	 *
	 * Event Save persists all dirty Proposals.
	 * If an Ordered Proposal is being made
	 * inactive, its production source must be
	 * removed before the inactive state is saved.
	 */
		const dirtyProposalIds =
					jsPropWorkspaces
		.dirtyProposalIds()
		.map(Number)
		.filter(id => id > 0);

		for (const proposalId of dirtyProposalIds) {
			const workspace =
						jsPropWorkspaces.get(
							proposalId
						);

			const savedProposal =
						(
							qryEvtGetPropsForEvent.data ||
							[]
						)
			.find(row =>
						Number(row.id || 0) ===
						proposalId
					 );

			const becomingInactive =
						workspace?.active === false &&
						workspace?.saved_active !== false;

			const isOrdered =
						savedProposal?.proposal_status ===
						"Ordered";

			if (
				becomingInactive &&
				isOrdered
			) {
				await storeValue(
					"evt_gro_unorder_after_action",
					"save_event"
				);

				await jsPropActions.unorder(
					proposalId
				);

				return false;
			}
		}

		/*
	 * SECOND:
	 * Check Event Active -> Inactive.
	 */
		const eventWorkspace =
					jsEvtWorkspace.get();

		const savedEvent =
					qryEvtGetItemById.data?.[0] ||
					null;

		const eventBecomingInactive =
					eventWorkspace?.active === false &&
					savedEvent?.active !== false;

		if (!eventBecomingInactive) {
			return true;
		}

		const ordered =
					this.orderedProposal();

		if (!ordered) {
			return true;
		}

		const proposalId =
					Number(
						ordered.id || 0
					);

		if (proposalId <= 0) {
			return true;
		}

		await storeValue(
			"evt_gro_unorder_after_action",
			"save_event"
		);

		await jsPropActions.unorder(
			proposalId
		);

		return false;
	},

	async saveAndReload() {
		const canContinue =
					await this
		.handleInactiveOrderedBeforeSave();

		if (!canContinue) {
			return false;
		}

		const currentProposalId =
					Number(
						appsmith.store.current_proposal_id ||
						0
					);

		const saveResult =
					await jsEvtSave
		.saveDocument();

		if (!saveResult) {
			return false;
		}

		const idMap =
					this.proposalIdMap(
						saveResult
					);

		/*
		 * Resolve the selected temporary
		 * Proposal to its new persisted ID.
		 */
		if (currentProposalId < 0) {
			const mappedId =
						Number(
							idMap[
								String(
									currentProposalId
								)
							] || 0
						);

			if (mappedId > 0) {
				await storeValue(
					"current_proposal_id",
					mappedId
				);
			}
			else {
				await removeValue(
					"current_proposal_id"
				);
			}
		}

		/*
		 * Reload committed Event truth.
		 */
		await qryEvtGetItemById.run();

		await jsEvtWorkspace
			.resetFromSaved();

		await qryEvtGetPropsForEvent.run();

		const resolvedProposalId =
					Number(
						appsmith.store.current_proposal_id ||
						0
					);

		/*
		 * Existing Proposal workspaces now represent
		 * the old pre-save baseline.
		 */
		await removeValue(
			"proposal_workspaces"
		);

		if (resolvedProposalId > 0) {
			await qryEvtGetSelectedProposal.run();

			await qryEvtGetSelectedPropMenus.run();

			await jsPropWorkspaces
				.initializeCurrentWorkspace();
		}
		else {
			await removeValue(
				"current_proposal_id"
			);
		}

		await resetWidget(
			"tblEvtComponents",
			true
		);

		showAlert(
			"Event saved.",
			"success"
		);

		return true;
	},

	proposalIdMap(resultRow) {
		const raw =
					resultRow?.proposal_id_map;

		if (!raw) {
			return {};
		}

		if (
			typeof raw === "object" &&
			!Array.isArray(raw)
		) {
			return raw;
		}

		if (typeof raw === "string") {
			try {
				return JSON.parse(
					raw
				);
			}
			catch (error) {
				return {};
			}
		}

		return {};
	},

	async confirm() {
		const action =
					appsmith.store
		.pendingEventAction ||
					null;

		if (!action) {
			return false;
		}

		try {
			const saved =
						await this
			.saveAndReload();

			if (!saved) {
				return false;
			}

			closeModal(
				mdlEvtUnsavedChanges.name
			);

			await removeValue(
				"pendingEventAction"
			);

			await removeValue(
				"evt_unsaved_title"
			);

			await removeValue(
				"evt_unsaved_message"
			);

			/*
			 * Continue the action that originally
			 * triggered the unsaved-changes modal.
			 */
			return await this
				.executeWithoutWarning(
				action
			);
		}
		catch (error) {
			showAlert(
				error?.message ||
				"Event and Proposals could not be saved. No changes were saved.",
				"error"
			);

			return false;
		}
	},

	async discardAndContinue() {
		const action =
					appsmith.store
		.pendingEventAction ||
					null;

		if (!action) {
			return false;
		}

		await this.discardAll();

		closeModal(
			mdlEvtUnsavedChanges.name
		);

		await removeValue(
			"pendingEventAction"
		);

		await removeValue(
			"evt_unsaved_title"
		);

		await removeValue(
			"evt_unsaved_message"
		);

		return await this
			.executeWithoutWarning(
			action
		);
	},

	async discardAll() {
		/*
		 * Restore Event Working State
		 * to last saved Event truth.
		 */
		await jsEvtWorkspace
			.resetFromSaved();

		/*
		 * Remove every unsaved Proposal workspace.
		 */
		await removeValue(
			"proposal_workspaces"
		);

		/*
		 * Reload persisted Proposal truth.
		 */
		await qryEvtGetPropsForEvent.run();

		const proposalId =
					Number(
						appsmith.store.current_proposal_id ||
						0
					);

		if (proposalId > 0) {
			await qryEvtGetSelectedProposal.run();

			await qryEvtGetSelectedPropMenus.run();

			await jsPropWorkspaces
				.initializeCurrentWorkspace();
		}
		else {
			await removeValue(
				"current_proposal_id"
			);
		}

		await resetWidget(
			"tblEvtComponents",
			true
		);

		return true;
	},

	async cancel() {
		closeModal(
			mdlEvtUnsavedChanges.name
		);

		await removeValue(
			"pendingEventAction"
		);

		await removeValue(
			"evt_unsaved_title"
		);

		await removeValue(
			"evt_unsaved_message"
		);

		await removeValue(
			"event_duplicate_snapshot"
		);

		await removeValue(
			"pendingEventNavigationTarget"
		);

		return true;
	},

	async requestNavigation(pageName) {
		const target =
					String(
						pageName || ""
					).trim();

		if (!target) {
			return false;
		}

		/*
		 * Capture current visible Event Header
		 * before any navigation decision.
		 */
		await jsEvtWorkspace.capture();

		const state =
					await this.dirtyState();

		/*
		 * Clean page:
		 * navigate immediately.
		 */
		if (
			!state.event_dirty &&
			!state.proposal_ids.length
		) {
			navigateTo(
				target,
				{},
				"SAME_WINDOW"
			);

			return true;
		}

		/*
		 * Dirty page:
		 * remember the destination and use
		 * Save / Discard / Cancel.
		 */
		await storeValue(
			"pendingEventNavigationTarget",
			target
		);

		await storeValue(
			"pendingEventAction",
			"navigate"
		);

		await storeValue(
			"evt_unsaved_title",
			"Unsaved Changes"
		);

		await storeValue(
			"evt_unsaved_message",
			this.actionMessage(
				state
			)
		);

		showModal(
			mdlEvtUnsavedChanges.name
		);

		return false;
	}
};