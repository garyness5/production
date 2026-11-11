export default {
	async init() {
		try {
			const ok = await jsAppInit.init();

			if (!ok) {
				return false;
			}

			await Promise.all([
				qryCtcGetContacts.run(),
				qryCtcGetCustomers.run(),
				qryCtcGetVenue.run()
			]);

			return true;
		} catch (error) {
			showAlert(
				error?.message ||
				"Contact List could not be loaded.",
				"error"
			);

			return false;
		}
	}
};