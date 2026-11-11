export default {
	async init() {

		const ready = await jsAppInit.init();

		if (!ready) {
			return false;
		}

		await qryGroPrnGetPrint.run();

		return true;
	}
};