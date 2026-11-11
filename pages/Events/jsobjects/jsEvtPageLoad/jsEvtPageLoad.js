export default {
	async load() {
		/*
		 * ==================================================
		 * SHARED APP INITIALIZATION
		 * ==================================================
		 */
		const ready =
					await jsAppInit.init();

		if (!ready) {
			return false;
		}

		const openMode =
					String(
						appsmith.store.event_open_mode || ""
					);

		/*
		 * Fresh Events-page session.
		 */
		await jsEvtWorkspace.clear();

		await removeValue(
			"current_proposal_id"
		);

		await removeValue(
			"proposal_workspaces"
		);

		/*
		 * Load the selected saved source Event.
		 */
		await qryEvtGetItemById.run();

		/*
 * Contact MultiSelect source data must exist before
 * the Event workspace establishes its saved selections.
 *
 * Otherwise Appsmith can evaluate a saved Contact ID
 * before that value exists in the widget sourceData,
 * causing intermittent missing Contacts and false dirty.
 */
		await Promise.all([
			qryEvtGetFormats.run(),
			qryEvtGetContacts.run(),
			qryEvtGetVenueContacts.run()
		]);

		await jsEvtWorkspace.initialize();

		await resetWidget(
			"msEvtContacts",
			true
		);

		await resetWidget(
			"msEvtVenueContacts",
			true
		);

		await storeValue(
			"accEvtCustomerNotes",
			false
		);

		await storeValue(
			"accEvtInternalNotes",
			false
		);

		/*
		 * ==================================================
		 * NEW EVENT HANDOFF
		 *
		 * EventList may supply the new Event name.
		 * A genuinely new Event begins with one
		 * temporary selected Proposal so Menu entry
		 * is immediately available.
		 * ==================================================
		 */
		if (
			Number(
				appsmith.store.current_event_id || 0
			) <= 0 &&
			String(
				appsmith.store.event_new_name || ""
			).trim()
		) {
			const newName =
						String(
							appsmith.store.event_new_name || ""
						).trim();

			await jsEvtWorkspace.set({
				...jsEvtWorkspace.emptyWorkspace(),
				name: newName
			});

			await removeValue(
				"event_new_name"
			);

			await jsPropActions.addNew();

			return true;
		}

		/*
		 * ==================================================
		 * EVENTLIST DUPLICATE HANDOFF
		 *
		 * The source has just been loaded from saved truth,
		 * so there is no dirty source workspace to guard.
		 *
		 * Use the same canonical Events Duplicate engine,
		 * but call it directly.
		 * ==================================================
		 */
		if (openMode === "duplicate") {
			await removeValue(
				"event_open_mode"
			);

			const staged =
						await jsEvtActions
			.stageDuplicateSnapshot(true);

			if (!staged) {
				showAlert(
					"Event duplicate could not be prepared.",
					"error"
				);

				return false;
			}

			return await jsEvtActions
				.openStagedDuplicate();
		}

		await removeValue(
			"event_open_mode"
		);

		return true;
	}
};