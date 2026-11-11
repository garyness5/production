export default {
	async load() {
		const ready = await jsAppInit.init();
		if (!ready) return false;

		await jsQuoWorkspace.reset();
		await removeValue("quotationPageSaved");
		await removeValue("quotationPageCurrent");
		await removeValue("quotationProposalId");
		await removeValue("quotationInboxId");
		await removeValue("quotationQuoteId");
		await jsQuoMenus.clear();

		const eventId = Number(
			appsmith.store.quotationEventId || 0
		);

		if (eventId <= 0) return true;

		await Promise.all([
			qryQuoGetEventHeader.run(),
			qryQuoGetEventProposals.run(),
			qryQuoGetEventDetails.run()
		]);

		await jsQuoPageWorkspace.load();

		const proposals = qryQuoGetEventProposals.data || [];

		if (proposals.length > 0) {
			const latest = [...proposals].sort(
				(a, b) =>
				new Date(b.last_sent_at).getTime() -
				new Date(a.last_sent_at).getTime()
			)[0];

			await jsQuoProposals.select(latest);
		}

		return true;
	}
};
