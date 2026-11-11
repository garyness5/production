export default {
	async init() {
		try {
			const ok = await jsAppInit.init();

			if (!ok) {
				return false;
			}

			await Promise.all([
				qryVnuGetVenues.run(),
				qryVnuGetContacts.run()
			]);

			return true;
		} catch (error) {
			showAlert(
				error?.message ||
				"Venue List could not be loaded.",
				"error"
			);

			return false;
		}
	}
};