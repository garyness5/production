export default {
	async select(row) {
		const proposalId = Number(row?.proposal_id || 0);
		const inboxId = Number(row?.inbox_id || 0);

		await removeValue("quotationQuoteId");
		await jsQuoMenus.clear();

		if (!proposalId || !inboxId) {
			await removeValue("quotationProposalId");
			await removeValue("quotationInboxId");
			return false;
		}

		await storeValue("quotationProposalId", proposalId);
		await storeValue("quotationInboxId", inboxId);

		await Promise.all([
			qryQuoGetReceivedMenus.run(),
			qryQuoGetReceivedMenuLines.run(),
			qryQuoGetQuotes.run()
		]);

		await jsQuoMenus.loadProposal();

		const quotes = qryQuoGetQuotes.data || [];

		if (quotes.length > 0) {
			const newest = [...quotes].sort(
				(a, b) => Number(b.quote_id) - Number(a.quote_id)
			)[0];

			await jsQuoQuotes.select(newest);
		}

		return true;
	}
};
