export default {
	async login() {
		try {
			// Authenticate without disturbing the existing workspace.
			const result = await apiLoginAuth.run().catch(error => {
				const response = apiLoginAuth.data;

				if (
					response?.error_code === "invalid_credentials" ||
					response?.error?.error_code === "invalid_credentials"
				) {
					throw {
						error_code: "invalid_credentials",
						message: "Invalid login credentials"
					};
				}

				throw error;
			});

			if (!result?.access_token || !result?.refresh_token) {
				jsUserErrors.show(
					"invalid_credentials",
					"There is an error in the email and/or password you entered. Please try again."
				);
				return { success: false };
			}

			// Verify the incoming identity using its own access token.
			const identity = await apiLoginEdgeIdentity.run({
				access_token: result.access_token
			});

			if (
				identity?.authenticated !== true ||
				!identity?.user_id ||
				!identity?.client_id
			) {
				showAlert(
					"Unable to verify the account. Login was not completed.",
					"error"
				);
				return { success: false };
			}

			const incomingUserId = String(identity.user_id);

			const previousUserId = String(
				appsmith.store.workspace_owner_user_id ||
				appsmith.store.current_user_id ||
				""
			);

			// An existing workspace without a verified owner cannot be reused.
			const sameUser =
						previousUserId !== "" &&
						previousUserId === incomingUserId;

			if (!sameUser) {
				// Different user, or unowned legacy workspace.
				// Clear ALL Appsmith store data, not just Recipe keys.
				await clearStore();
			}

			const expiresAt =
						Date.now() + Number(result.expires_in || 3600) * 1000;

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
				expiresAt,
				true
			);

			// Workspace ownership is the verified Supabase Auth user.
			await storeValue(
				"workspace_owner_user_id",
				incomingUserId,
				true
			);

			await storeValue("current_user_id", incomingUserId);
			await storeValue("current_client_id", identity.client_id);
			await storeValue("current_user_name", identity.user_name);
			await storeValue("current_client_name", identity.client_name);

			return {
				success: true,
				sameUser,
				expiresAt: new Date(expiresAt).toISOString()
			};

		} catch (error) {
			// Authentication failure must not destroy existing unsaved work.
			const rawError = jsUserErrors.rawMessage(error);

			if (
				/invalid_credentials|invalid login credentials/i.test(rawError) ||
				Number(error?.statusCode || error?.status) === 400
			) {
				jsUserErrors.show("invalid_credentials");
			} else {
				jsUserErrors.show(
					error,
					"Unable to complete login. Please try again."
				);
			}

			return { success: false };
		}
	},

	async logout() {
		let revoked = false;

		try {
			// Attempt server-side session revocation first.
			// Refresh an expired access token if possible.
			const expiresAt = Number(
				appsmith.store.savveyra_token_expires_at || 0
			);

			if (
				appsmith.store.savveyra_refresh_token &&
				expiresAt <= Date.now() + 60000
			) {
				const refreshed = await apiLoginRefreshSupaSession.run();

				if (refreshed?.access_token && refreshed?.refresh_token) {
					await storeValue(
						"savveyra_access_token",
						refreshed.access_token,
						true
					);
					await storeValue(
						"savveyra_refresh_token",
						refreshed.refresh_token,
						true
					);
				}
			}

			if (appsmith.store.savveyra_access_token) {
				await apiLoginSignOut.run();
				revoked = true;
			}
		} catch (error) {
			revoked = false;
		}

		// Explicit Logout always removes the local workspace.
		await clearStore();

		if (revoked) {
			showAlert("Logged out successfully.", "success");
		} else {
			showAlert(
				"Local session cleared. Server logout could not be confirmed.",
				"warning"
			);
		}

		return revoked;
	},

	checkToken() {
		const token = String(
			appsmith.store.savveyra_access_token || ""
		);

		const refreshToken = String(
			appsmith.store.savveyra_refresh_token || ""
		);

		try {
			const payload = JSON.parse(
				atob(
					token.split(".")[1]
					.replace(/-/g, "+")
					.replace(/_/g, "/")
				)
			);

			return {
				accessTokenPresent: true,
				refreshTokenPresent: !!refreshToken,
				currentTime: new Date().toISOString(),
				expiresAt: new Date(
					payload.exp * 1000
				).toISOString(),
				expired: Date.now() >= payload.exp * 1000
			};
		} catch (error) {
			jsUserErrors.show(
				error,
				"Unable to complete login. Please try again."
			);

			return { success: false };
		}
	}
};
