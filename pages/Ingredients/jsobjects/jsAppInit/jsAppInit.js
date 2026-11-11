export default {
	lastFailure: null,

	async clearIdentity() {
		const keys = [
			"current_client_id",
			"current_client_name",
			"current_user_id",
			"current_user_name"
		];

		for (const key of keys) {
			await removeValue(key);
		}
	},

	async init() {
		this.lastFailure = null;

		try {
			const workspaceOwner = String(
				appsmith.store.workspace_owner_user_id || ""
			);

			if (!workspaceOwner) {
				this.lastFailure = "login_required";
				await storeValue("ingPageReady", false);
				await clearStore();
				navigateTo("Login", {}, "SAME_WINDOW");
				return false;
			}

			const sessionValid = await jsAuthSession.ensureValid();

			if (!sessionValid) {
				this.lastFailure =
					jsAuthSession.lastFailure === "login_required"
					? "login_required"
				: "service_unavailable";

				await storeValue("ingPageReady", false);

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
			}

			const identity = await apiIngGetMyIdentity.run();

			if (
				identity?.authenticated !== true ||
				!identity?.user_id ||
				!identity?.client_id
			) {
				this.lastFailure =
					identity?.authenticated === false
					? "login_required"
				: "identity_unavailable";

				await storeValue("ingPageReady", false);

				if (this.lastFailure === "login_required") {
					await clearStore();
					navigateTo("Login", {}, "SAME_WINDOW");
				} else {
					showAlert(
						"Unable to verify your Savveyra account. Please try again.",
						"error"
					);
				}

				return false;
			}

			const verifiedUserId = String(identity.user_id);

			if (verifiedUserId !== workspaceOwner) {
				this.lastFailure = "account_changed";
				await storeValue("ingPageReady", false);
				await clearStore();
				navigateTo("Login", {}, "SAME_WINDOW");
				return false;
			}

			await storeValue("current_client_id", identity.client_id);
			await storeValue("current_user_id", verifiedUserId);
			await storeValue("current_client_name", identity.client_name);
			await storeValue("current_user_name", identity.user_name);

			return true;

		} catch (error) {
			this.lastFailure = "service_unavailable";

			console.error(
				"Ingredients initialization identity check failed:",
				error
			);

			await storeValue("ingPageReady", false);

			showAlert(
				"Unable to connect to Savveyra. Please try again.",
				"error"
			);

			return false;
		}
	},

};