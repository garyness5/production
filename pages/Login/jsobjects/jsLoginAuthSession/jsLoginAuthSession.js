export default {
	async ensureValid() {
		const token = appsmith.store.savveyra_access_token;
		const refreshToken = appsmith.store.savveyra_refresh_token;
		const expiresAt = Number(
			appsmith.store.savveyra_token_expires_at || 0
		);

		if (!refreshToken) {
			return false;
		}

		// Keep the existing token if it has over 5 minutes left.
		if (token && expiresAt > Date.now() + 5 * 60 * 1000) {
			return true;
		}

		return await this.refresh();
	},

	async refresh() {
		try {
			const result = await apiLoginRefreshSupaSession.run();

			if (!result?.access_token || !result?.refresh_token) {
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

			return true;
		} catch (error) {
			return false;
		}
	},

	status() {
		return {
			accessTokenPresent: !!appsmith.store.savveyra_access_token,
			refreshTokenPresent: !!appsmith.store.savveyra_refresh_token,
			expiresAt: appsmith.store.savveyra_token_expires_at
			? new Date(
				Number(appsmith.store.savveyra_token_expires_at)
			).toISOString()
			: null,
			refreshRequired:
			Number(appsmith.store.savveyra_token_expires_at || 0) <=
			Date.now() + 5 * 60 * 1000
		};
	}
};
