export default {
	hasSelectedProposal() {
		return (
			Number(
				appsmith.store.current_proposal_id || 0
			) !== 0
		);
	},

	canUseProposalActions() {
		return this.hasSelectedProposal();
	},

	canDiscardProposal() {
		const proposalId =
					Number(
						appsmith.store.current_proposal_id || 0
					);

		return (
			this.hasSelectedProposal() &&
			proposalId > 0 &&
			jsPropWorkspaces.isDirty(
				proposalId
			)
		);
	},

	proposal() {
		const proposalId =
					Number(
						appsmith.store.current_proposal_id || 0
					);

		if (
			proposalId < 0 &&
			jsPropWorkspaces
			.get(proposalId)
			?.is_new === true
		) {
			const workspace =
						jsPropWorkspaces
			.get(proposalId);

			return {
				id:
				proposalId,

				event_id:
				Number(
					appsmith.store.current_event_id || 0
				),

				proposal_no:
				null,

				proposal_number:
				null,

				proposal_status:
				"Draft",

				temp_proposal_no:
				workspace?.temp_proposal_no ??
				null,

				active:
				true,

				is_new:
				true,

				source_proposal_id:
				workspace
				?.source_proposal_id ??
				null,

				is_closed:
				false,

				is_editable:
				true
			};
		}

		return (
			qryEvtGetSelectedProposal.data?.[0] ??
			{}
		);
	},

	referenceDisplay(row) {
		if (!row) {
			return "";
		}

		const proposalId =
					Number(
						row.id || 0
					);

		const isDirty =
					proposalId !== 0 &&
					jsPropWorkspaces
		.isDirty(proposalId);

		let reference = "";

		if (row.is_new === true) {
			reference =
				row.temp_proposal_no != null
				? `Draft ${row.temp_proposal_no}`
			: "New Proposal";
		}
		else if (row.proposal_number) {
			reference =
				row.proposal_number;
		}
		else if (row.proposal_no != null) {
			reference =
				`Draft ${row.proposal_no}`;
		}

		return (
			row.is_new === true ||
			isDirty
		)
			? `• ${reference}`
		: reference;
	},
};