export default {
	busy: false,

	async logout() {
		if (this.busy) return false;
		this.busy = true;

		try {
			await storeValue("listsPageReady", false);

			try {
				if (appsmith.store.savveyra_access_token) {
					await apiLstSignOut.run();
				}
			} catch (error) {
				console.error("Supabase logout failed:", error);
			}

			await clearStore();
			navigateTo("Login", {}, "SAME_WINDOW");
			return true;

		} finally {
			this.busy = false;
		}
	}
};
