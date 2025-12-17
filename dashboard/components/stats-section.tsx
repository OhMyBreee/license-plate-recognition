import { Separator } from "@/components/ui/separator";
import { Car, Clock, CheckCircle, XCircle } from "lucide-react";

export default function StatsSection({ mounted, dynamicStats, totalDatabaseCount }) {
  return (
    <div className="p-4 backdrop-blur-sm border rounded-xl w-full">
      
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-0">

        {/* Total Scanned */}
        <div className="flex items-center space-x-4 flex-1">
          <Car className="w-10 h-10 text-blue-400" />
          <div>
            <p className="text-slate-400 text-sm">Total Scanned</p>
            <p className="text-2xl font-bold text-white mt-1">
              {mounted ? totalDatabaseCount.toLocaleString() : "0"}
            </p>
          </div>
        </div>

        {/* Separator */}
        <Separator className="my-2 lg:my-0 lg:h-auto lg:w-px" />

        {/* Recent Scans */}
        <div className="flex items-center space-x-4 flex-1">
          <Clock className="w-10 h-10 text-purple-400" />
          <div>
            <p className="text-slate-400 text-sm">Recent Scans</p>
            <p className="text-2xl font-bold text-white mt-1">
              {mounted ? dynamicStats.totalRecent : "0"}
            </p>
          </div>
        </div>

        <Separator className="my-2 lg:my-0 lg:h-auto lg:w-px" />

        {/* Accuracy */}
        <div className="flex items-center space-x-4 flex-1">
          <CheckCircle className="w-10 h-10 text-green-400" />
          <div>
            <p className="text-slate-400 text-sm">Recent Accuracy</p>
            <p className="text-2xl font-bold text-white mt-1">
              {mounted ? dynamicStats.accuracy : "0.0"}%
            </p>
          </div>
        </div>

        <Separator className="my-2 lg:my-0 lg:h-auto lg:w-px" />

        {/* Blocked */}
        <div className="flex items-center space-x-4 flex-1">
          <XCircle className="w-10 h-10 text-red-400" />
          <div>
            <p className="text-slate-400 text-sm">Total Failed</p>
            <p className="text-2xl font-bold text-white mt-1">
              {mounted ? dynamicStats.blockedCount : "0"}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
