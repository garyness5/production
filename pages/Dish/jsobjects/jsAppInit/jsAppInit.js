export default {
	async init() {
		if (appsmith.store.current_client_id) {
			return true;
		}

		const rows = await qryResolveUser.run();

		if (!rows || !rows.length) {
			await removeValue("current_client_id");
			await removeValue("current_user_id");
			await removeValue("current_client_name");
			await removeValue("current_user_name");

			showAlert(
				"Your Savveyra account is not activated. Please contact the administrator.",
				"warning"
			);

			return false;
		}

		const user = rows[0];

		await storeValue("current_client_id", user.client_id);
		await storeValue("current_user_id", user.user_id);
		await storeValue("current_client_name", user.client_name);
		await storeValue("current_user_name", user.display_name || user.email);

		return true;
	}
};