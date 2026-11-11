export default {
	getSaved() {
		return appsmith.store.quotationPageSaved || {};
	},

	getCurrent() {
		return appsmith.store.quotationPageCurrent || {};
	},

	isDirty() {
		return JSON.stringify(this.getCurrent()) !==
			JSON.stringify(this.getSaved());
	},

	async load() {
		const row = (qryQuoGetEventDetails.data || [])[0] || {};

		const data = {
			event_id: Number(row.event_id || 0),
			internal_notes: row.internal_notes ?? null
		};

		await storeValue("quotationPageSaved", data);
		await storeValue("quotationPageCurrent", { ...data });

		return true;
	},

	async captureInternalNotes() {
		const current = { ...this.getCurrent() };

		if (!current.event_id) return false;

		current.internal_notes =
			rteQuoInternalNotes.text || null;

		await storeValue("quotationPageCurrent", current);
		return true;
	}
};
