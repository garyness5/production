export default {
	async load() {
		const ok = await jsAppInit.init();

		if (!ok) {
			return false;
		}

		await Promise.all([
			qryDshListGetDshCategories.run(),
			qryDshListGetDishList.run()
		]);

		return true;
	}
};