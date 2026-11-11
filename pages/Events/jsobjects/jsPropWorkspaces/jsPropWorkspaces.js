export default {
	all() {
		return appsmith.store.proposal_workspaces || {};
	},

	currentProposalId() {
		return Number(
			appsmith.store.current_proposal_id || 0
		);
	},

	get(
		proposalId = this.currentProposalId()
	) {
		return (
			this.all()[String(proposalId)] ||
			null
		);
	},

	async saveAll(workspaces) {
		await storeValue(
			"proposal_workspaces",
			workspaces || {}
		);

		return workspaces || {};
	},

	async set(
		proposalId,
		workspace
	) {
		const id =
					Number(proposalId || 0);

		if (!id) {
			return null;
		}

		const workspaces = {
			...this.all(),

			[String(id)]: {
				...(this.get(id) || {}),
				...workspace,
				proposal_id: id
			}
		};

		await this.saveAll(workspaces);

		return workspaces[String(id)];
	},

	deepCopy(value) {
		return JSON.parse(
			JSON.stringify(value)
		);
	},

	componentsFromQuery() {
		return jsPropComponents
			.normalizeRows(
			jsPropComponents.queryRows()
		);
	},

	normalizeComponents(rows) {
		return (rows || [])
			.filter(row =>
							Number(row?.menu_id || 0) > 0 ||
							String(row?.menu_name || "").trim()
						 )
			.map((row, index) => ({
			line_no:
			index + 1,

			menu_id:
			Number(
				row.menu_id || 0
			) || null,

			guests:
			row.guests === "" ||
			row.guests === null ||
			row.guests === undefined
			? null
			: Number(row.guests),

			extra_guests:
			row.extra_guests === "" ||
			row.extra_guests === null ||
			row.extra_guests === undefined
			? 0
			: Number(row.extra_guests),

			notes:
			String(
				row.notes || ""
			).trim() ||
			null,

			active:
			row.active === false
			? false
			: true
		}));
	},

	workspaceIsDirty(
		proposalId = this.currentProposalId()
	) {
		const workspace =
					this.get(proposalId);

		if (!workspace) {
			return false;
		}

		const current =
					this.normalizeComponents(
						workspace.components
					);

		const saved =
					this.normalizeComponents(
						workspace.saved_components
					);

		const componentsDirty =
					JSON.stringify(current) !==
					JSON.stringify(saved);

		const activeDirty =
					(workspace.active === false) !==
					(workspace.saved_active === false);

		return (
			componentsDirty ||
			activeDirty
		);
	},

	async initializeCurrentWorkspace() {
		if (
			!jsPropData.hasSelectedProposal()
		) {
			return null;
		}

		const proposalId =
					this.currentProposalId();

		const existing =
					this.get(proposalId);

		if (
			existing &&
			this.isDirty(proposalId)
		) {
			return existing;
		}

		const queryComponents =
					this.componentsFromQuery();

		const proposal =
					qryEvtGetSelectedProposal.data?.[0] || {};

		const queryUpdatedAt =
					proposal.updated_at || null;

		const queryActive =
					proposal.active === false
		? false
		: true;

		return await this.set(
			proposalId,
			{
				components:
				queryComponents,

				saved_components:
				this.deepCopy(
					queryComponents
				),

				active:
				queryActive,

				saved_active:
				queryActive,

				saved_updated_at:
				queryUpdatedAt
			}
		);
	},

	async setCurrentComponents(rows) {
		const proposalId =
					this.currentProposalId();

		if (!proposalId) {
			return false;
		}

		const workspaces = {
			...(appsmith.store.proposal_workspaces || {})
		};

		const key =
					String(proposalId);

		const workspace =
					workspaces[key];

		if (!workspace) {
			return false;
		}

		workspaces[key] = {
			...workspace,

			components:
			jsPropComponents.normalizeRows(
				rows || []
			)
		};

		await storeValue(
			"proposal_workspaces",
			workspaces
		);

		return true;
	},

	async setActive(proposalId, active) {
		const id = Number(proposalId || 0);

		if (!id) {
			return false;
		}

		return await this.set(
			id,
			{
				active: active === true
			}
		);
	},

	isDirty(
		proposalId = this.currentProposalId()
	) {
		const workspace =
					this.get(proposalId);

		if (!workspace) {
			return false;
		}

		const isCurrentProposal =
					Number(proposalId) ===
					this.currentProposalId();

		const currentRows =
					isCurrentProposal
		? jsPropComponents.mergeUpdatedRows()
		: workspace.components;

		const currentComponents =
					this.normalizeComponents(
						currentRows
					);

		const savedComponents =
					this.normalizeComponents(
						workspace.saved_components
					);

		const componentsDirty =
					JSON.stringify(currentComponents) !==
					JSON.stringify(savedComponents);

		const activeDirty =
					(workspace.active === false) !==
					(workspace.saved_active === false);

		return (
			componentsDirty ||
			activeDirty
		);
	},

	isMeaningfulTemporary(
		proposalId
	) {
		const id =
					Number(
						proposalId || 0
					);

		if (id >= 0) {
			return false;
		}

		const workspace =
					this.get(id);

		if (!workspace) {
			return false;
		}

		const components =
					this.normalizeComponents(
						workspace.components || []
					);

		return components.length > 0;
	},

	dirtyProposalIds() {
		return Object.keys(
			this.all()
		)
			.map(Number)
			.filter(id =>
							this.isDirty(id) ||
							this.isMeaningfulTemporary(id)
						 );
	},

	async discard(proposalId) {
		const id =
					Number(proposalId || 0);

		const workspaces = {
			...this.all()
		};

		delete workspaces[
			String(id)
		];

		await this.saveAll(
			workspaces
		);

		return true;
	},

	makeTemporaryId() {
		const existingIds =
					Object.keys(
						this.all()
					)
		.map(Number)
		.filter(id => id < 0);

		let tempId =
				-Math.max(
					1,
					Date.now()
				);

		while (
			existingIds.includes(
				tempId
			)
		) {
			tempId -= 1;
		}

		return tempId;
	},

	async createTemporary(
		components = [],
		sourceProposalId = null,
		active = true
	) {
		const tempId =
					this.makeTemporaryId();

		const normalized =
					jsPropComponents
		.normalizeRows(
			this.deepCopy(
				components || []
			)
		);

		await this.set(
			tempId,
			{
				proposal_id:
				tempId,

				is_new:
				true,

				source_proposal_id:
				Number(sourceProposalId || 0) ||
				null,

				active:
				active !== false,

				/*
			 * New Proposal has no Published
			 * Active state yet.
			 *
			 * Use its initial Working State as
			 * the baseline so a blank new
			 * Proposal is not dirty merely
			 * because Active defaults true.
			 */
				saved_active:
				active !== false,

				components:
				normalized,

				saved_components:
				jsPropComponents
				.normalizeRows([]),

				saved_updated_at:
				null
			}
		);

		await storeValue(
			"current_proposal_id",
			tempId
		);

		return tempId;
	},

	async renumberTemporaryDrafts() {
		const workspaces = {
			...this.all()
		};

		/*
	 * Start after the highest real saved
	 * Proposal number for this Event.
	 */
		const maxSavedNo =
					Math.max(
						0,
						...(qryEvtGetPropsForEvent.data || [])
						.map(row =>
								 Number(row.proposal_no || 0)
								)
						.filter(Boolean)
					);

		/*
	 * Only duplicated/temp Drafts that already
	 * use Draft numbering participate.
	 *
	 * A normal blank "New Proposal" keeps that
	 * label until first Save.
	 */
		const tempIds =
					Object.keys(workspaces)
		.map(Number)
		.filter(id =>
						id < 0 &&
						workspaces[String(id)]
						?.temp_proposal_no != null
					 );

		tempIds.forEach(
			(id, index) => {
				workspaces[String(id)] = {
					...workspaces[String(id)],

					temp_proposal_no:
					maxSavedNo + index + 1
				};
			}
		);

		await this.saveAll(
			workspaces
		);

		return true;
	},

	async createTemporaryBatch(
		proposals = []
	) {
		const createdIds = [];

		for (const proposal of proposals) {
			const tempId =
						this.makeTemporaryId();

			const normalized =
						jsPropComponents
			.normalizeRows(
				this.deepCopy(
					proposal.components || []
				)
			);

			await this.set(
				tempId,
				{
					proposal_id:
					tempId,

					is_new:
					true,

					source_proposal_id:
					Number(
						proposal.source_proposal_id || 0
					) || null,

					active:
					proposal?.active !== false,

					saved_active:
					proposal?.active !== false,

					/*
		 * Used only for displaying
		 * Draft 1, Draft 2, etc.
		 * while this duplicated Event
		 * still exists only in Working State.
		 */
					temp_proposal_no:
					Number(
						proposal.temp_proposal_no || 0
					) || null,

					components:
					normalized,

					saved_components:
					jsPropComponents
					.normalizeRows([]),

					saved_updated_at:
					null
				}
			);

			createdIds.push(
				tempId
			);
		}

		if (createdIds.length) {
			await storeValue(
				"current_proposal_id",
				createdIds[0]
			);
		}

		return createdIds;
	},

	async syncPublishedActive(id, active) {

		const proposalId = Number(id || 0);

		if (!proposalId) {
			return false;
		}

		const workspaces = {
			...(appsmith.store.proposal_workspaces || {})
		};

		const key = String(proposalId);
		const workspace = workspaces[key];

		if (!workspace) {
			return false;
		}

		workspaces[key] = {
			...workspace,
			active: active === true,
			saved_active: active === true
		};

		await storeValue(
			"proposal_workspaces",
			workspaces
		);

		return true;
	},
};