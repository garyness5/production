export default {
	clone(value) {
		return JSON.parse(JSON.stringify(value));
	},

	getAll() {
		return appsmith.store.quotationWorkspaces || {};
	},

	getActiveKey() {
		return appsmith.store.quotationActiveWorkspaceKey || null;
	},

	getActive() {
		return this.getAll()[this.getActiveKey()] || null;
	},

	hasActive() {
		return !!this.getActive();
	},

	isDirty() {
		const ws = this.getActive();
		if (!ws) return false;
		if (ws.isTemporary) return true;

		return JSON.stringify(ws.current) !==
			JSON.stringify(ws.saved);
	},

	async select(key) {
		if (!this.getAll()[key]) return false;

		await storeValue("quotationActiveWorkspaceKey", key);
		return true;
	},

	async putSaved(quoteId, data) {
		const key = `quote:${Number(quoteId)}`;
		const all = this.clone(this.getAll());

		if (!all[key]) {
			all[key] = {
				key,
				quoteId: Number(quoteId),
				isTemporary: false,
				saved: this.clone(data),
				current: this.clone(data)
			};

			await storeValue("quotationWorkspaces", all);
		}

		return key;
	},

	async addTemporary(data) {
		const nextId = Number(
			appsmith.store.quotationNextTemporaryId || 1
		);

		const key = `temp:${nextId}`;
		const all = this.clone(this.getAll());

		all[key] = {
			key,
			quoteId: null,
			isTemporary: true,
			saved: null,
			current: this.clone(data)
		};

		await storeValue("quotationWorkspaces", all);
		await storeValue("quotationNextTemporaryId", nextId + 1);
		await storeValue("quotationActiveWorkspaceKey", key);

		return key;
	},

	canSave() {
		return this.hasActive()
		&& this.isDirty()
		&& !qryQuoSaveMenuPricing.isLoading
		&& !qryQuoCreateQuoteFromWorkspace.isLoading
		&& !qryQuoSaveWorkspacePricing.isLoading;
	},

	async duplicateActive() {
		const source = this.getActive();
		if (!source) return null;

		// Copy the current working state, including unsaved edits.
		const data = this.clone(source.current);

		if (!data.header) {
			throw new Error("Quote header is missing.");
		}

		// New Quote identity and lifecycle.
		data.header.quote_id = null;
		data.header.quote_number = null;
		data.header.quote_status = "Draft";
		data.header.quote_date = null;
		data.header.closed = false;

		// Clear lifecycle fields without changing quote content.
		data.header.issued_at = null;
		data.header.accepted_at = null;

		// Menu rows retain pricing but receive new database identities.
		data.menus = (data.menus || []).map(row => ({
			...row,
			quote_id: null,
			quote_menu_id: null
		}));

		return await this.addTemporary(data);
	},

	async discardActive() {
		const key = this.getActiveKey();
		const all = this.clone(this.getAll());
		const ws = all[key];

		if (!ws) return false;

		if (ws.isTemporary) {
			// Delete the unsaved workspace only.
			delete all[key];

			await storeValue("quotationWorkspaces", all);
			await removeValue("quotationActiveWorkspaceKey");
			await removeValue("quotationQuoteId");
			await storeValue("quotationMenuRows", []);

			return true;
		}

		// Restore the saved Quote.
		if (!ws.saved) {
			throw new Error("Saved Quote state is unavailable.");
		}

		ws.current = this.clone(ws.saved);

		await storeValue("quotationWorkspaces", all);
		await storeValue(
			"quotationMenuRows",
			this.clone(ws.current.menus || [])
		);

		return true;
	},

	async updateMenus(rows) {
		const key = this.getActiveKey();
		const all = this.clone(this.getAll());

		if (!key || !all[key]) return false;

		all[key].current.menus = this.clone(rows);

		await storeValue("quotationWorkspaces", all);
		return true;
	},

	async updateCurrent(data) {
		const key = this.getActiveKey();
		const all = this.clone(this.getAll());

		if (!all[key]) return false;

		all[key].current = this.clone(data);
		await storeValue("quotationWorkspaces", all);

		return true;
	},

	async promoteToSavedIdentity(quoteId) {
		const id = Number(quoteId);
		const oldKey = this.getActiveKey();
		const newKey = `quote:${id}`;
		const all = this.clone(this.getAll());

		if (!id || !oldKey || !all[oldKey]) {
			return false;
		}

		const source = all[oldKey];

		if (
			source.quoteId &&
			Number(source.quoteId) !== id
		) {
			throw new Error("Workspace Quote ID mismatch.");
		}

		if (oldKey !== newKey && all[newKey]) {
			throw new Error(
				`Quote ${id} already has a workspace.`
			);
		}

		const promoted = {
			...source,
			key: newKey,
			quoteId: id,
			isTemporary: false,
			current: this.clone(source.current)
		};

		promoted.current.header = {
			...(promoted.current.header || {}),
			quote_id: id
		};

		// No pricing has been saved yet.
		// Preserve the dirty state until Save completes.
		if (source.isTemporary) {
			promoted.saved = null;
		}

		delete all[oldKey];
		all[newKey] = promoted;

		await storeValue("quotationWorkspaces", all);
		await storeValue("quotationActiveWorkspaceKey", newKey);
		await storeValue("quotationQuoteId", id);

		return true;
	},

	async markSaved(quoteId, data) {
		const oldKey = this.getActiveKey();
		const all = this.clone(this.getAll());

		if (!all[oldKey]) return false;

		const newKey = `quote:${Number(quoteId)}`;

		delete all[oldKey];

		all[newKey] = {
			key: newKey,
			quoteId: Number(quoteId),
			isTemporary: false,
			saved: this.clone(data),
			current: this.clone(data)
		};

		await storeValue("quotationWorkspaces", all);
		await storeValue("quotationActiveWorkspaceKey", newKey);

		return true;
	},

	getSelectorRows() {
		const inboxId = Number(appsmith.store.quotationInboxId || 0);
		if (!inboxId) return [];

		const saved = (qryQuoGetQuotes.data || []).map(r => ({
			...r,
			workspace_key: `quote:${Number(r.quote_id)}`,
			is_temporary: false
		}));

		const temporary = Object.values(this.getAll())
		.filter(ws =>
						ws.isTemporary &&
						Number(ws.current?.header?.inbox_id || 0) === inboxId
					 )
		.map(ws => ({
			quote_id: null,
			workspace_key: ws.key,
			is_temporary: true,
			quote_status: "Draft",
			quote_title: ws.current?.header?.quote_title || "New Quote"
		}));

		return [...temporary, ...saved];
	},


	async captureCurrentFields() {
		const key = this.getActiveKey();
		const all = this.clone(this.getAll());

		if (!key || !all[key]) return false;

		const ws = all[key];

		if (ws.current?.header?.closed) return false;

		const header = ws.current.header || {};

		const fields = {
			quote_title: inpQuoQuoteTitle.text || null,
			valid_until: datQuoValidUntil.selectedDate || null,
			quote_notes: rteQuoQuoteNotes.text || null,
			terms: rteQuoTerms.text || null
		};

		const updatedHeader = {
			...header,
			...fields
		};

		if (
			JSON.stringify(updatedHeader) ===
			JSON.stringify(header)
		) {
			return true;
		}

		ws.current.header = updatedHeader;

		await storeValue("quotationWorkspaces", all);
		return true;
	},


	async updateHeaderField(field, value) {
		const allowed = [
			"quote_title",
			"valid_until",
			"quote_notes",
			"internal_notes",
			"terms"
		];

		if (!allowed.includes(field)) {
			throw new Error(`Invalid Quote field: ${field}`);
		}

		const key = this.getActiveKey();
		const all = this.clone(this.getAll());

		if (!key || !all[key]) return false;
		if (all[key].current?.header?.closed) {
			showAlert("Closed Quotes cannot be edited.", "warning");
			return false;
		}

		all[key].current.header = {
			...all[key].current.header,
			[field]: value
		};

		await storeValue("quotationWorkspaces", all);
		return true;
	},

	async reset() {
		await removeValue("quotationWorkspaces");
		await removeValue("quotationActiveWorkspaceKey");
		await removeValue("quotationNextTemporaryId");
		return true;
	}
};
