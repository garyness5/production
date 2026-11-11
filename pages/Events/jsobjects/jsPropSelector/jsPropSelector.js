export default {
	async clearSelection() {
		await removeValue(
			"current_proposal_id"
		);

		await removeValue(
			"proposal_loading"
		);

		await resetWidget(
			"tblEvtComponents",
			true
		);

		return true;
	},

	async loadSelectedProposal() {
		const proposalId =
					Number(
						appsmith.store.current_proposal_id || 0
					);

		if (!proposalId) {
			return null;
		}

		/*
	 * Temporary Proposal:
	 * no Supabase row exists yet.
	 */
		if (proposalId < 0) {
			await removeValue(
				"proposal_loading"
			);

			await resetWidget(
				"tblEvtComponents",
				true
			);

			return jsPropWorkspaces
				.get(proposalId);
		}

		await storeValue(
			"proposal_loading",
			true
		);

		try {
			await qryEvtGetSelectedProposal.run();

			const loadedId =
						Number(
							qryEvtGetSelectedProposal
							.data?.[0]?.id || 0
						);

			if (loadedId !== proposalId) {
				throw new Error(
					"Selected Proposal could not be loaded."
				);
			}

			await qryEvtGetSelectedPropMenus.run();

			await jsPropWorkspaces
				.initializeCurrentWorkspace();

			await resetWidget(
				"tblEvtComponents",
				true
			);

			return (
				qryEvtGetSelectedProposal
				.data?.[0] ||
				null
			);

		} catch (error) {
			await this.clearSelection();

			showAlert(
				error?.message ||
				"Proposal could not be loaded.",
				"error"
			);

			return null;

		} finally {
			await removeValue(
				"proposal_loading"
			);
		}
	},

	onRowSelected() {
		const selectedRow =
					tblPropForEvent.selectedRow;

		const selectedId =
					Number(selectedRow?.id || 0);

		const currentId =
					Number(
						appsmith.store.current_proposal_id || 0
					);

		if (!selectedId) {
			return this.clearSelection();
		}

		/*
	 * A table-data refresh may re-fire
	 * onRowSelected for the Proposal that
	 * is already selected.
	 *
	 * That is not a real selection change.
	 */
		if (selectedId === currentId) {
			return true;
		}

		return this.selectProposal(
			selectedRow
		);
	},

	async selectProposal(row) {
		const newProposalId =
					Number(
						row?.id || 0
					);

		if (!newProposalId) {
			return false;
		}

		/*
	 * Preserve visible Event Header edits
	 * before Proposal selection causes any
	 * reactive refresh.
	 */
		await jsEvtWorkspace.capture();

		await storeValue(
			"current_proposal_id",
			newProposalId
		);

		const loaded =
					await this.loadSelectedProposal();

		await resetWidget(
			"tblPropForEvent",
			true
		);

		return loaded;
	}
};