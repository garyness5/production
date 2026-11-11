export default {
	selectedEventId() {
		return Number(tblEvtList.selectedRow?.id || 0);
	},

	hasSelection() {
		return this.selectedEventId() > 0;
	},

	async openSelectedEvent() {
		if (!this.hasSelection()) {
			showAlert(
				"Select an event first.",
				"warning"
			);

			return false;
		}

		/*
	 * Opening another saved Event abandons
	 * any unsaved Events-page Working State.
	 */
		await removeValue(
			"event_workspace"
		);

		await removeValue(
			"current_proposal_id"
		);

		await removeValue(
			"proposal_workspaces"
		);

		await removeValue(
			"event_open_mode"
		);

		await storeValue(
			"current_event_id",
			this.selectedEventId()
		);

		navigateTo("Events");

		return true;
	},

	async addEvent() {
		const newName =
					String(
						inpEvtListAddName.text || ""
					).trim();

		if (!newName) {
			showAlert(
				"Enter an Event name.",
				"warning"
			);

			return false;
		}

		/*
	 * Clear any stale Events-page state.
	 */
		await removeValue(
			"event_workspace"
		);

		await removeValue(
			"current_proposal_id"
		);

		await removeValue(
			"proposal_workspaces"
		);

		await removeValue(
			"event_duplicate_snapshot"
		);

		await removeValue(
			"event_open_mode"
		);

		/*
	 * Carry the EventList-entered name
	 * into the new Events workspace.
	 */
		await storeValue(
			"event_new_name",
			newName
		);

		await storeValue(
			"current_event_id",
			0
		);

		navigateTo(
			"Events",
			{},
			"SAME_WINDOW"
		);

		return true;
	},

	async duplicateSelectedEvent() {
		if (!this.hasSelection()) {
			showAlert(
				"Select an event first.",
				"warning"
			);

			return false;
		}

		/*
	 * Clear any stale Events-page Working State.
	 */
		await removeValue(
			"event_workspace"
		);

		await removeValue(
			"current_proposal_id"
		);

		await removeValue(
			"proposal_workspaces"
		);

		await removeValue(
			"event_duplicate_snapshot"
		);

		/*
	 * Open the selected saved Event on Events first.
	 *
	 * Events owns the actual Duplicate / Save As engine.
	 */
		await storeValue(
			"current_event_id",
			this.selectedEventId()
		);

		await storeValue(
			"event_open_mode",
			"duplicate"
		);

		navigateTo(
			"Events",
			{},
			"SAME_WINDOW"
		);

		return true;
	},

	async deleteSelectedEventStart() {
		if (!this.hasSelection()) {
			showAlert("Select an event first.", "warning");
			return false;
		}

		try {
			const result =
						await qryEvtLstGetDeleteImpact.run();

			const impact =
						result?.[0] || null;

			if (!impact) {
				throw new Error(
					"Event delete impact could not be checked."
				);
			}

			await storeValue(
				"evt_list_delete_impact",
				impact
			);

			showModal(mdlEvtDelete.name);

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

	async deleteSelectedEventConfirm() {
		if (!this.hasSelection()) {
			showAlert(
				"Select an event first.",
				"warning"
			);
			return false;
		}

		try {
			const result =
						await qryEvtLstDeleteList.run();

			const row =
						result?.[0] || null;

			if (row?.deleted !== true) {
				throw new Error(
					"Event could not be deleted."
				);
			}

			await removeValue(
				"evt_list_delete_impact"
			);

			closeModal(
				mdlEvtDelete.name
			);

			await qryEvtLstGetList.run();

			showAlert(
				"Event deleted.",
				"success"
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

	async cancelDelete() {
		await removeValue(
			"evt_list_delete_impact"
		);

		closeModal(
			mdlEvtDelete.name
		);

		return true;
	},

	deleteWarningText() {
		const impact =
					appsmith.store.evt_list_delete_impact || {};

		if (impact.has_groceries_materialized === true) {
			return "Groceries, Details and Order will be updated to reflect the remaining Events. Manually entered quantities will be kept for ingredients still required.<br><br>Do you want to remove?";
		}

		return "Do you want to delete this Event?";
	},

	async changeActive(action) {
		if (!action?.id) {
			return false;
		}

		try {
			/*
		 * Activating is always immediate.
		 */
			if (action.active === true) {
				await storeValue(
					"evt_list_active_confirmed",
					false
				);

				await qryEvtLstSetActive.run();

				await removeValue(
					"evt_list_active_confirmed"
				);

				await removeValue(
					"evt_list_active_action"
				);

				await qryEvtLstGetList.run();

				resetWidget(
					"tblEvtList",
					true
				);

				return true;
			}

			/*
		 * Check Groceries before deactivating.
		 */
			const result =
						await qryEvtLstGetActiveImpact.run();

			const impact =
						result?.[0] || null;

			if (!impact) {
				throw new Error(
					"Event impact could not be checked."
				);
			}

			/*
		 * Materialized Groceries requires confirmation.
		 * Keep evt_list_active_action until Yes/Cancel.
		 */
			if (impact.has_groceries_materialized === true) {
				await storeValue(
					"evt_list_active_impact",
					impact
				);

				await qryEvtLstGetList.run();

				resetWidget(
					"tblEvtList",
					true
				);

				showModal(
					mdlEvtListActive.name
				);

				return false;
			}

			/*
		 * No Groceries or queue-only.
		 */
			await storeValue(
				"evt_list_active_confirmed",
				false
			);

			await qryEvtLstSetActive.run();

			await removeValue(
				"evt_list_active_confirmed"
			);

			await removeValue(
				"evt_list_active_action"
			);

			await qryEvtLstGetList.run();

			resetWidget(
				"tblEvtList",
				true
			);

			return true;
		}
		catch (error) {
			await removeValue(
				"evt_list_active_confirmed"
			);

			await removeValue(
				"evt_list_active_action"
			);

			await qryEvtLstGetList.run();

			resetWidget(
				"tblEvtList",
				true
			);

			showAlert(
				error?.message ||
				"Event could not be updated.",
				"error"
			);

			return false;
		}
	},

	async onActiveChange() {
		const updates =
					tblEvtList.updatedRows || [];

		const update =
					updates[updates.length - 1];

		if (!update) {
			return false;
		}

		const eventId =
					Number(
						update.id ||
						update.allFields?.id ||
						update.updatedFields?.id ||
						0
					);

		if (!eventId) {
			return false;
		}

		const newActive =
					update.updatedFields?.active;

		if (typeof newActive !== "boolean") {
			return false;
		}

		await storeValue(
			"evt_list_active_action",
			{
				id: eventId,
				active: newActive
			}
		);

		return await this.changeActive(
			appsmith.store.evt_list_active_action
		);
	},

	async confirmActiveChange() {
		try {
			await storeValue(
				"evt_list_active_confirmed",
				true
			);

			await qryEvtLstSetActive.run();

			await removeValue(
				"evt_list_active_confirmed"
			);

			await removeValue(
				"evt_list_active_action"
			);

			await removeValue(
				"evt_list_active_impact"
			);

			closeModal(
				mdlEvtListActive.name
			);

			await qryEvtLstGetList.run();

			resetWidget(
				"tblEvtList",
				true
			);

			return true;
		}
		catch (error) {
			await removeValue(
				"evt_list_active_confirmed"
			);

			showAlert(
				error?.message ||
				"Event could not be made inactive.",
				"error"
			);

			return false;
		}
	},

	async cancelActiveChange() {
		await removeValue(
			"evt_list_active_confirmed"
		);

		await removeValue(
			"evt_list_active_action"
		);

		await removeValue(
			"evt_list_active_impact"
		);

		closeModal(
			mdlEvtListActive.name
		);

		await qryEvtLstGetList.run();

		resetWidget(
			"tblEvtList",
			true
		);

		return true;
	},

	filteredEvents() {
		const rows =
					qryEvtLstGetList.data || [];

		const filter =
					selEvtListFilter.selectedOptionValue ||
					"active";

		switch (filter) {
			case "active":
				return rows.filter(row =>
													 row.active === true &&
													 row.status !== "Closed"
													);

			case "inactive":
				return rows.filter(row =>
													 row.active === false &&
													 row.status !== "Closed"
													);

			case "closed":
				return rows.filter(row =>
													 row.status === "Closed"
													);

			case "all":
			default:
				return rows;
		}
	},
}