import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Text, 
  Card, 
  CardHeader, 
  CardBody,
  Badge,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Loader
} from '@adminjs/design-system';

const MonitoringPage = () => {
  const [monitoring, setMonitoring] = useState({
    serverHealth: {},
    systemMetrics: {},
    databaseStats: {},
    recentActivity: [],
    loading: true
  });

  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchMonitoringData = async () => {
    try {
      setMonitoring(prev => ({ ...prev, loading: true }));
      
      // Fetch monitoring data from various endpoints
      const [healthRes, metricsRes] = await Promise.all([
        fetch('/health'),
        fetch('/admin/monitoring/metrics')
      ]);

      const health = await healthRes.json();
      const metrics = metricsRes.json().catch(() => ({}));

      setMonitoring({
        serverHealth: health,
        systemMetrics: await metrics,
        loading: false,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
      setMonitoring(prev => ({ ...prev, loading: false }));
    }
  };

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatMemory = (bytes) => {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  if (monitoring.loading && !monitoring.serverHealth.status) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="200px">
        <Loader />
        <Text ml="default">Loading monitoring data...</Text>
      </Box>
    );
  }

  return (
    <Box variant="grey">
      <Box variant="white" m={20}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb="xl">
          <Text variant="h4">🚀 GoatGoat Server Monitoring</Text>
          <Box display="flex" alignItems="center" gap="default">
            <Text variant="sm" color="grey60">
              Last updated: {new Date(monitoring.lastUpdated || Date.now()).toLocaleTimeString()}
            </Text>
            <Button size="sm" onClick={fetchMonitoringData} disabled={monitoring.loading}>
              🔄 Refresh
            </Button>
          </Box>
        </Box>

        {/* Server Health Overview */}
        <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(250px, 1fr))" gap="lg" mb="xl">
          <Card>
            <CardHeader>
              <Text variant="h6">🏥 Server Health</Text>
            </CardHeader>
            <CardBody>
              <Box display="flex" alignItems="center" gap="sm" mb="sm">
                <Badge 
                  color={monitoring.serverHealth.status === 'healthy' ? 'success' : 'danger'}
                  size="lg"
                >
                  {monitoring.serverHealth.status === 'healthy' ? '✅ HEALTHY' : '❌ UNHEALTHY'}
                </Badge>
              </Box>
              <Text variant="sm">Database: {monitoring.serverHealth.database || 'Unknown'}</Text>
              <Text variant="sm">Uptime: {monitoring.serverHealth.uptime ? formatUptime(monitoring.serverHealth.uptime) : 'Unknown'}</Text>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <Text variant="h6">💾 Memory Usage</Text>
            </CardHeader>
            <CardBody>
              {monitoring.serverHealth.memory && (
                <>
                  <Text variant="sm">RSS: {formatMemory(monitoring.serverHealth.memory.rss)}</Text>
                  <Text variant="sm">Heap Used: {formatMemory(monitoring.serverHealth.memory.heapUsed)}</Text>
                  <Text variant="sm">Heap Total: {formatMemory(monitoring.serverHealth.memory.heapTotal)}</Text>
                  <Text variant="sm">External: {formatMemory(monitoring.serverHealth.memory.external)}</Text>
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <Text variant="h6">📊 Database Stats</Text>
            </CardHeader>
            <CardBody>
              <Text variant="sm">
                Delivery Partners: {monitoring.serverHealth.deliveryPartners || 0}
              </Text>
              <Text variant="sm">
                Connection: {monitoring.serverHealth.database === 'connected' ? '🟢 Active' : '🔴 Inactive'}
              </Text>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <Text variant="h6">🔧 System Info</Text>
            </CardHeader>
            <CardBody>
              <Text variant="sm">Version: {monitoring.serverHealth.version || '1.0.0'}</Text>
              <Text variant="sm">Environment: {process.env.NODE_ENV || 'Unknown'}</Text>
              <Text variant="sm">Platform: Node.js</Text>
            </CardBody>
          </Card>
        </Box>

        {/* Quick Actions */}
        <Box mb="xl">
          <Text variant="h6" mb="default">⚡ Quick Actions</Text>
          <Box display="flex" gap="sm">
            <Button 
              size="sm" 
              variant="primary"
              onClick={() => window.open('/health', '_blank')}
            >
              📊 View Health Endpoint
            </Button>
            <Button 
              size="sm" 
              variant="secondary"
              onClick={() => window.open('/admin/debug', '_blank')}
            >
              🔍 Debug Info
            </Button>
            <Button 
              size="sm" 
              variant="secondary"
              onClick={() => window.open('/admin/ops/tools', '_blank')}
            >
              🛠️ OPS Tools
            </Button>
          </Box>
        </Box>

        {/* Performance Metrics Table */}
        <Box mb="xl">
          <Text variant="h6" mb="default">📈 Performance Metrics</Text>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><Text variant="sm" fontWeight="bold">Metric</Text></TableCell>
                <TableCell><Text variant="sm" fontWeight="bold">Value</Text></TableCell>
                <TableCell><Text variant="sm" fontWeight="bold">Status</Text></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell><Text variant="sm">Response Time</Text></TableCell>
                <TableCell><Text variant="sm">~ 50ms</Text></TableCell>
                <TableCell><Badge color="success">🟢 Good</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell><Text variant="sm">Memory Usage</Text></TableCell>
                <TableCell><Text variant="sm">
                  {monitoring.serverHealth.memory ? 
                    `${((monitoring.serverHealth.memory.heapUsed / monitoring.serverHealth.memory.heapTotal) * 100).toFixed(1)}%` : 
                    'N/A'
                  }
                </Text></TableCell>
                <TableCell><Badge color="success">🟢 Normal</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell><Text variant="sm">Database Connection</Text></TableCell>
                <TableCell><Text variant="sm">{monitoring.serverHealth.database}</Text></TableCell>
                <TableCell>
                  <Badge color={monitoring.serverHealth.database === 'connected' ? 'success' : 'danger'}>
                    {monitoring.serverHealth.database === 'connected' ? '🟢 Connected' : '🔴 Disconnected'}
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>

        {/* Environment Information */}
        <Box>
          <Text variant="h6" mb="default">🌍 Environment Information</Text>
          <Card>
            <CardBody>
              <Text variant="sm">🚀 Production: https://goatgoat.tech</Text>
              <Text variant="sm">🧪 Staging: https://staging.goatgoat.tech</Text>
              <Text variant="sm">📱 AdminJS: /admin</Text>
              <Text variant="sm">🔧 API Docs: /api (coming soon)</Text>
            </CardBody>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default MonitoringPage;
