export default {
	async load() {
		const ok =
					await jsAppInit.init();

		if (!ok) {
			return false;
		}

		await Promise.all([
			qryMnuLstGetMnuList.run(),
			qryMnuLstGetMnuCategories.run()
		]);

		return true;
	}
};