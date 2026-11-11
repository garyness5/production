export default {
	async init() {

		const ready = await jsAppInit.init();

		if (!ready) {
			return false;
		}

		await Promise.all([
			qryOrdGetUnits.run(),
			qryOrdGetSuppliers.run(),
			qryOrdGetPackaging.run()
		]);

		await qryOrdGetGroceryOrder.run();

		return true;
	}
};