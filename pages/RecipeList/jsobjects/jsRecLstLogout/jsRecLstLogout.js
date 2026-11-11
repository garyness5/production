export default {
	busy: false,

	async logout() {
		if (this.busy) return false;
		this.busy = true;

		try {
			await storeValue("recListPageReady", false);

			try {
				if (appsmith.store.savveyra_access_token) {
					await apiRecLstSignOut.run();
				}
			} catch (error) {
				console.error("RecipeList Supabase logout failed:", error);
			}

			await clearStore();
			navigateTo("Login", {}, "SAME_WINDOW");
			return true;

		} finally {
			this.busy = false;
		}
	},
};
