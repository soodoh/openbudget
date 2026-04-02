export function GridHeader() {
	return (
		<div
			className="grid items-center gap-2 px-4 py-2"
			style={{ gridTemplateColumns: "1fr 90px 90px 90px" }}
		>
			<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
				Category
			</span>
			<span className="text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
				Assigned
			</span>
			<span className="text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
				Activity
			</span>
			<span className="text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
				Available
			</span>
		</div>
	);
}
