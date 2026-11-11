export default {
	async clearForDifferentUser() {
		// Hide protected Ingredients content immediately.
		await storeValue("ingPageReady", false);

		// Close any open Ingredients editing dialogs.
		closeModal(mdlAddIng.name);
		closeModal(mdlIngUnsaved.name);
		closeModal(mdlIngDelete.name);
		closeModal(mdlIngUnitTypeWarning.name);

		// Clear form and table widget state.
		await resetWidget("mdlAddIng", true);
		await resetWidget("tblIngList", true);

		// Clear all previous operator's stored workspace data.
		await clearStore();

		return true;
	}
};