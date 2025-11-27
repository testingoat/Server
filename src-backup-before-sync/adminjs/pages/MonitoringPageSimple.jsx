import React from 'react';
import { Box, Text } from '@adminjs/design-system';

const MonitoringPageSimple = () => {
  return (
    <Box variant="grey">
      <Box variant="white" m={20}>
        <Text variant="h4">🚀 Server Monitoring Dashboard (Test)</Text>
        <Text mt="default">This is a test monitoring page to verify component loading works.</Text>
        <Text mt="default">If you see this, the component path resolution is working!</Text>
      </Box>
    </Box>
  );
};

export default MonitoringPageSimple;
