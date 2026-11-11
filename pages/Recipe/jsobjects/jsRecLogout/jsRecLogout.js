export default {
	busy: false,

	async logout() {
		if (this.busy) return false;
		this.busy = true;

		try {
			await storeValue("recPageReady", false);

			try {
				if (appsmith.store.savveyra_access_token) {
					await apiRecSignOut.run();
				}
			} catch (error) {
				console.error("Recipe Supabase logout failed:", error);
			}

			await clearStore();
			navigateTo("Login", {}, "SAME_WINDOW");
			return true;

		} finally {
			this.busy = false;
		}
	},
};
