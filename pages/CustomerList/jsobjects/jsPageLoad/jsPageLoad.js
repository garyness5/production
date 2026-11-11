export default {
	async init() {
		try {
			const ok = await jsAppInit.init();

			if (!ok) {
				return false;
			}

			await Promise.all([
				qryCusGetCustomers.run(),
				qryCusGetContacts.run()
			]);

			return true;
		} catch (error) {
			showAlert(
				error?.message ||
				"Customer List could not be loaded.",
				"error"
			);

			return false;
		}
	}
};