export default {
	async openEvent(row) {
		if (!row?.event_id) {
			showAlert("Select an Event.", "warning");
			return;
		}

		await storeValue(
			"quotationEventId",
			Number(row.event_id)
		);

		// Opening an Event must NOT select a Proposal or Quote.
		await removeValue("quotationProposalId");
		await removeValue("quotationQuoteId");

		navigateTo("Quote");
	},

	async setActive(row, isActive) {
		if (!row?.event_id) {
			showAlert("No Event was selected.", "warning");
			return;
		}

		await qryQuoLstSetEventActive.run({
			eventId: row.event_id,
			isActive
		});

		await qryQuoLstGetList.run();
	},

	searchRows() {
		const rows = qryQuoLstGetList.data || [];
		const search = (inpQuoLstSearch.text || "").trim().toLowerCase();

		if (!search) return rows;

		return rows.filter(row =>
											 [
			row.event_name,
			row.event_ref,
			row.customer_name,
			row.company,
			row.contact_person,
			row.venue_name
		].some(value =>
					 String(value ?? "").toLowerCase().includes(search)
					)
											);
	}
};