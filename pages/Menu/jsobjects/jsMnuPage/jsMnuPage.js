export default {
	async load() {
		const ok = await jsAppInit.init();

		if (!ok) {
			return false;
		}

		await Promise.all([
			qryMnuGetCategories.run(),
			qryMnuGetDietTags.run(),
			qryMnuGetComponentItems.run(),
			qryMnuGetComponentUnits.run()
		]);

		const mode =
					String(
						appsmith.store.Menu_open_mode ||
						appsmith.store.Menu_mode ||
						"edit"
					);

		await jsMnuWorkspace.clear();

		if (mode === "add") {
			await jsMnuWorkspace.initializeNew();
			await jsMnuCompTable.clearRows();

			await removeValue(
				"Menu_open_mode"
			);

			return true;
		}

		const menuId =
					Number(
						appsmith.store.current_menu_id || 0
					);

		if (!menuId) {
			await jsMnuWorkspace.initializeNew();
			await jsMnuCompTable.clearRows();

			await removeValue(
				"Menu_open_mode"
			);

			return true;
		}

		await Promise.all([
			qryMnuGetItemById.run(),
			qryMnuGetSelectedDietTags.run(),
			qryMnuGetComponents.run()
		]);

		await jsMnuWorkspace.initializeFromSaved();
		await jsMnuCompTable.loadFromQuery();

		if (mode === "duplicate") {
			await removeValue(
				"Menu_open_mode"
			);

			await resetWidget("inpMnuName", true);
			await resetWidget("selMnuCategory", true);
			await resetWidget("chkMnuActive", true);
			await resetWidget("inpMnuServes", true);
			await resetWidget("inpMnuExtraPercent", true);
			await resetWidget("msMnuDietTags", true);
			await resetWidget("rteMnuNotes", true);

			return await jsMnuSave.duplicateMenu();
		}


	await removeValue(
	"Menu_open_mode"
	);

await storeValue(
	"Menu_mode",
	"edit"
);

return true;
}
};