export default {
	busy: false,

	async logout() {
		if (this.busy) return false;
		this.busy = true;

		try {
			await storeValue("ingPageReady", false);

			try {
				if (appsmith.store.savveyra_access_token) {
					await apiIngSignOut.run();
				}
			} catch (error) {
				console.error("Ingredients Supabase logout failed:", error);
			}

			await clearStore();
			navigateTo("Login", {}, "SAME_WINDOW");
			return true;

		} finally {
			this.busy = false;
		}
	},
};
