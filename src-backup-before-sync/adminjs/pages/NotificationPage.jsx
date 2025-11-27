import React, { useState } from 'react';
import { Box, Button, Text, Input, Textarea, Select, Alert } from '@adminjs/design-system';
import { ApiClient } from '@adminjs/core';

const api = new ApiClient();

const NotificationPage = () => {
  const [notificationType, setNotificationType] = useState('push');
  const [targetType, setTargetType] = useState('all');
  const [targetValue, setTargetValue] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dataPayload, setDataPayload] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  const handleSendNotification = async () => {
    setLoading(true);
    setResponse(null);
    setError(null);

    try {
      let parsedData = {};
      if (notificationType === 'push' && dataPayload) {
        try {
          parsedData = JSON.parse(dataPayload);
        } catch (e) {
          setError({ message: 'Invalid JSON for Data Payload.' });
          setLoading(false);
          return;
        }
      }

      const payload = {
        type: notificationType,
        target: {
          type: targetType,
          value: targetType === 'users' || targetType === 'sms' ? targetValue.split(',').map(s => s.trim()) : targetValue,
        },
        message: {
          title: notificationType === 'push' ? title : undefined,
          body: body,
          data: notificationType === 'push' ? parsedData : undefined,
        },
      };

      const res = await api.post('/api/notifications/send', payload);
      setResponse(res.data);
    } catch (e) {
      setError(e.response?.data || { message: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box variant="grey">
      <Box variant="white" m={20}>
        <Text variant="h4">Notification Center</Text>
        <Text mt="default">Send Push Notifications or SMS messages to your users.</Text>

        <Box mt="xl">
          <Text variant="h5">1. Choose Notification Type</Text>
          <Select
            value={notificationType}
            onChange={(e) => setNotificationType(e.value)}
            options={[
              { value: 'push', label: 'Push Notification (FCM)' },
              { value: 'sms', label: 'SMS (Fast2SMS)' },
            ]}
          />
        </Box>

        <Box mt="xl">
          <Text variant="h5">2. Compose Message</Text>
          {notificationType === 'push' && (
            <Input
              placeholder="Title (for Push Notifications)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              mt="default"
            />
          )}
          <Textarea
            placeholder="Message Body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            mt="default"
          />
          {notificationType === 'push' && (
            <Textarea
              placeholder="Data Payload (JSON, optional)"
              value={dataPayload}
              onChange={(e) => setDataPayload(e.target.value)}
              mt="default"
            />
          )}
        </Box>

        <Box mt="xl">
          <Text variant="h5">3. Select Target Audience</Text>
          <Select
            value={targetType}
            onChange={(e) => setTargetType(e.value)}
            options={[
              { value: 'all', label: 'All Users' },
              { value: 'topic', label: 'Specific Topic' },
              { value: 'users', label: 'Specific Users (by ID/Phone)' },
            ]}
          />
          {(targetType === 'topic' || targetType === 'users') && (
            <Input
              placeholder={targetType === 'topic' ? 'Enter Topic Name (e.g., buyer_notifications)' : 'Enter User IDs or Phone Numbers (comma-separated)'}
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              mt="default"
            />
          )}
        </Box>

        <Button onClick={handleSendNotification} disabled={loading} mt="xl">
          {loading ? 'Sending...' : 'Send Notification'}
        </Button>

        {response && (
          <Alert variant="success" mt="xl">
            <Text>Success!</Text>
            <Text>{JSON.stringify(response, null, 2)}</Text>
          </Alert>
        )}

        {error && (
          <Alert variant="danger" mt="xl">
            <Text>Error!</Text>
            <Text>{JSON.stringify(error, null, 2)}</Text>
          </Alert>
        )}
      </Box>
    </Box>
  );
};

export default NotificationPage;
