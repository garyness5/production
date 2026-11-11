export default {
	async init() {

		const ready = await jsAppInit.init();

		if (!ready) {
			return false;
		}

		await qryDtlGetDetails.run();

		return true;
	}
};