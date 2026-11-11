export default {
	async load() {
		const ok = await jsAppInit.init();

		if (!ok) {
			return false;
		}

		await Promise.all([
			qryDshGetFormats.run(),
			qryDshGetDietTags.run(),
			qryDshGetComponentItems.run()
		]);

		const mode =
					String(
						appsmith.store.Dish_open_mode ||
						appsmith.store.Dish_mode ||
						"edit"
					);

		await jsDshWorkspace.clear();

		if (mode === "add") {
			await jsDshWorkspace.initializeNew();
			await jsDshCompTable.clearRows();

			await removeValue(
				"Dish_open_mode"
			);

			return true;
		}

		const dishId =
					Number(
						appsmith.store.current_dish_id || 0
					);

		if (!dishId) {
			await jsDshWorkspace.initializeNew();
			await jsDshCompTable.clearRows();

			await removeValue(
				"Dish_open_mode"
			);

			return true;
		}

		await Promise.all([
			qryDshGetItemById.run(),
			qryDshGetSelectedDietTags.run(),
			qryDshGetComponents.run()
		]);

		await jsDshWorkspace.initializeFromSaved();

		await jsDshCompTable.loadFromQuery();

		if (mode === "duplicate") {
			await removeValue(
				"Dish_open_mode"
			);

			await resetWidget("inpDshName", true);
			await resetWidget("selDshCategory", true);
			await resetWidget("selDshFormat", true);
			await resetWidget("chkDshActive", true);
			await resetWidget("inpDshServes", true);
			await resetWidget("inpDshExtraPercent", true);
			await resetWidget("msDshDietTags", true);
			await resetWidget("rteDshNotes", true);

			return await jsDshSave.duplicateDish();
		}

		await removeValue(
			"Dish_open_mode"
		);

		await storeValue(
			"Dish_mode",
			"edit"
		);

		return true;
	}
};