import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SendTokenModal from "@/components/SendTokenModal";
import GetTokenButton from "@/components/GetTokenButton";
import PoolsTable from "@/components/PoolsTable";
import SponsorDashboard from "@/components/SponsorDashboard";
import RebalancerPanel from "@/components/RebalancerPanel";

export default function Home() {
  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Send Tokens Without Gas
            </h2>
            <p className="text-muted-foreground">
              Every token should be as easy to send as a text message
            </p>
          </div>
          <div className="flex gap-2">
            <SendTokenModal />
            <GetTokenButton />
          </div>
        </div>

        <Tabs defaultValue="pools" className="space-y-6" data-testid="tabs-main">
          <TabsList>
            <TabsTrigger value="pools" data-testid="tab-pools">
              Pools
            </TabsTrigger>
            <TabsTrigger value="sponsor" data-testid="tab-sponsor">
              Sponsor
            </TabsTrigger>
            <TabsTrigger value="rebalance" data-testid="tab-rebalance">
              Rebalance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pools" className="space-y-6">
            <PoolsTable />
          </TabsContent>

          <TabsContent value="sponsor" className="space-y-6">
            <SponsorDashboard />
          </TabsContent>

          <TabsContent value="rebalance" className="space-y-6">
            <RebalancerPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
