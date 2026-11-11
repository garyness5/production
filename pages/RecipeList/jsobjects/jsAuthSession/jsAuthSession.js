export default {
	lastFailure: null,
	refreshInProgress: null,

	async ensureValid() {
		this.lastFailure = null;

		const token = appsmith.store.savveyra_access_token;
		const refreshToken = appsmith.store.savveyra_refresh_token;
		const expiresAt = Number(
			appsmith.store.savveyra_token_expires_at || 0
		);

		if (!refreshToken) {
			this.lastFailure = "login_required";
			return false;
		}

		if (token && expiresAt > Date.now() + 5 * 60 * 1000) {
			return true;
		}

		return await this.refresh();
	},

	async refresh() {
		if (this.refreshInProgress) {
			return await this.refreshInProgress;
		}

		this.refreshInProgress = this.performRefresh();

		try {
			return await this.refreshInProgress;
		} finally {
			this.refreshInProgress = null;
		}
	},

	async performRefresh() {
		try {
			const result = await apiRecLstRefreshSupaSession.run();

			if (!result?.access_token || !result?.refresh_token) {
				this.lastFailure = "service_unavailable";
				return false;
			}

			await storeValue(
				"savveyra_access_token",
				result.access_token,
				true
			);
			await storeValue(
				"savveyra_refresh_token",
				result.refresh_token,
				true
			);
			await storeValue(
				"savveyra_token_expires_at",
				Date.now() + Number(result.expires_in || 3600) * 1000,
				true
			);

			this.lastFailure = null;
			return true;

		} catch (error) {
			const status = Number(
				error?.statusCode ||
				error?.status ||
				error?.responseMeta?.statusCode ||
				0
			);

			this.lastFailure =
				[400, 401].includes(status)
				? "login_required"
			: "service_unavailable";

			console.error(
				"RecipeList session renewal failed:",
				status,
				error
			);

			return false;
		}
	},

	async requireValid() {
		const valid = await this.ensureValid();
		if (valid) return true;

		await storeValue("recListPageReady", false);

		if (this.lastFailure === "login_required") {
			await clearStore();
			navigateTo("Login", {}, "SAME_WINDOW");
		} else {
			showAlert(
				"Unable to connect to Savveyra. Please try again.",
				"error"
			);
		}

		return false;
	},

};
