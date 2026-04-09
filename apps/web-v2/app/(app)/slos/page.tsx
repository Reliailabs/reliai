"use client"

import { useState } from "react"
import { TrendingUp, TrendingDown, Minus, CheckCircle, AlertTriangle } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { slos } from "@/lib/mock-data";

const statusConfig = {
	healthy: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", border: "border-emerald-500/20", icon: CheckCircle },
	at_risk: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", border: "border-amber-500/20", icon: AlertTriangle },
	breached: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", border: "border-red-500/20", icon: AlertTriangle },
};
const trendIcon = { up: TrendingUp, down: TrendingDown, flat: Minus };
const trendColor = { up: "text-emerald-400", down: "text-red-400", flat: "text-zinc-400" };
function ProgressBar({ current, target }: { current: number; target: number }) {
	return (
		<div className="mt-2 h-2 w-24 bg-zinc-800 rounded-full overflow-hidden">
			<div
				className={cn("h-2 rounded-full", current >= target ? "bg-emerald-400" : "bg-amber-400")}
				style={{ width: `${Math.min(100, (current / target) * 100)}%` }}
			/>
		</div>
	);
}
export default function SLOsPage() {
	const [selectedProject, setSelectedProject] = useState("sentiment-analyzer");
	const [selectedPeriod, setSelectedPeriod] = useState("30d");

	// Filter SLOs by project and period
	const filteredSLOs = slos.filter((slo) => slo.project === selectedProject && slo.period === selectedPeriod);

	return (
		<div className="p-6 space-y-6">
			<PageHeader
				title="Service Level Objectives"
				description="Track SLO compliance and trends for your AI projects"
				right={
					<div className="flex items-center gap-2">
						<span className="text-xs text-zinc-500">Project:</span>
						<div className="flex gap-2">
							{[...new Set(slos.map((slo) => slo.project))].map((project) => (
								<button
									key={project as string}
									onClick={() => setSelectedProject(project as string)}
									className={cn(
										"px-3 py-1.5 text-xs rounded transition-colors font-medium",
										selectedProject === project
											? "bg-zinc-700 text-zinc-200"
											: "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
									)}
								>
									{project}
								</button>
							))}
						</div>
					</div>
				}
			/>

			{/* Period selector */}
			<div className="flex items-center gap-4">
				<span className="text-sm text-zinc-500">Period:</span>
				<div className="flex gap-2">
					{["7d", "30d", "90d"].map((period) => (
						<button
							key={period}
							onClick={() => setSelectedPeriod(period)}
							className={cn(
								"px-3 py-1 text-xs rounded transition-colors",
								selectedPeriod === period
									? "bg-zinc-700 text-zinc-200"
									: "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
							)}
						>
							{period}
						</button>
					))}
				</div>
			</div>

			{/* SLOs table */}
			<div className="border border-zinc-800 rounded-lg overflow-hidden">
				<div className="bg-zinc-900/50 border-b border-zinc-800 px-6 py-4">
					<h3 className="text-sm font-medium text-zinc-200">
						{filteredSLOs.length} SLO{filteredSLOs.length !== 1 ? "s" : ""}
					</h3>
				</div>
				<div className="divide-y divide-zinc-800">
					{filteredSLOs.map((slo) => {
						const StatusIcon = statusConfig[slo.status as keyof typeof statusConfig].icon;
						const TrendIcon = trendIcon[slo.trend as keyof typeof trendIcon];
						return (
							<div key={slo.id} className="px-6 py-4 hover:bg-zinc-900/30 transition-colors">
								<div className="flex items-center gap-4">
																<StatusIcon className={cn("w-5 h-5", statusConfig[slo.status as keyof typeof statusConfig].color)} />
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-3">
											<h4 className="text-sm font-medium text-zinc-200">{slo.name}</h4>
																		<span className={cn(
																		"inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider border",
																		statusConfig[slo.status as keyof typeof statusConfig].bg,
																		statusConfig[slo.status as keyof typeof statusConfig].color,
																		statusConfig[slo.status as keyof typeof statusConfig].border
																		)}>
												{slo.status.replace('_', ' ')}
											</span>
										</div>
										<p className="text-xs text-zinc-500 mt-1">{slo.description}</p>
									</div>
									<div className="text-right">
										<div className="flex items-center gap-2">
											<span className="text-sm font-medium text-zinc-200 tabular-nums">
												{slo.current}%
											</span>
											<span className="text-xs text-zinc-500">/ {slo.target}%</span>
																		<TrendIcon className={cn("w-4 h-4", trendColor[slo.trend as keyof typeof trendColor])} />
										</div>
										<ProgressBar current={slo.current} target={slo.target} />
									</div>
									<div className="text-right text-xs text-zinc-500 min-w-[80px]">
																		{/* <div>{slo.breachCount} breaches</div> */}
																		<div className="italic text-zinc-700">no breach data</div>
																		{/* {slo.lastBreach && (
																		<div className="mt-1">
																		{new Date(slo.lastBreach).toLocaleDateString()}
																		</div>
																		)} */}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}