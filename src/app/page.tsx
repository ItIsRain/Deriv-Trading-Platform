'use client';

import { useState, useEffect } from 'react';
import { Container, Title, Text, TextInput, Button, Paper, Group, Badge, Table, SimpleGrid, Card, CopyButton, ActionIcon, Tooltip } from '@mantine/core';
import { IconUsers, IconUserPlus, IconChartLine, IconCurrencyDollar, IconCopy, IconCheck, IconLink } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';
import { initializePartner, createAffiliate, getAffiliates, getClients, getTrades, getStats } from '@/lib/store';
import type { Affiliate } from '@/types';

export default function PartnerDashboard() {
  const [affiliateName, setAffiliateName] = useState('');
  const [affiliateEmail, setAffiliateEmail] = useState('');
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [stats, setStats] = useState({ totalAffiliates: 0, totalClients: 0, totalTrades: 0, totalVolume: 0, totalProfit: 0 });
  const [generatedLink, setGeneratedLink] = useState('');

  useEffect(() => {
    // Initialize partner on mount
    initializePartner();
    refreshData();
  }, []);

  const refreshData = () => {
    setAffiliates(getAffiliates());
    setStats(getStats());
  };

  const handleCreateAffiliate = () => {
    if (!affiliateName.trim() || !affiliateEmail.trim()) {
      notifications.show({
        title: 'Error',
        message: 'Please enter both name and email',
        color: 'red',
      });
      return;
    }

    const affiliate = createAffiliate(affiliateName, affiliateEmail);
    const link = `${window.location.origin}/trade/${affiliate.referralCode}`;
    setGeneratedLink(link);

    notifications.show({
      title: 'Affiliate Invited!',
      message: `Referral link generated for ${affiliateName}`,
      color: 'green',
    });

    setAffiliateName('');
    setAffiliateEmail('');
    refreshData();
  };

  const getClientCount = (affiliateId: string) => {
    return getClients().filter(c => c.affiliateId === affiliateId).length;
  };

  const getTradeCount = (affiliateId: string) => {
    const clientIds = getClients().filter(c => c.affiliateId === affiliateId).map(c => c.id);
    return getTrades().filter(t => clientIds.includes(t.accountId)).length;
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <Container size="xl" className="py-4">
          <Group justify="space-between">
            <Group>
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">L</span>
              </div>
              <div>
                <Title order={4} className="text-gray-900">LunarGraph</Title>
                <Text size="xs" c="dimmed">Partner Portal</Text>
              </div>
            </Group>
            <Group>
              <Link href="/dashboard">
                <Button variant="light" color="red" leftSection={<IconChartLine size={16} />}>
                  Fraud Intelligence
                </Button>
              </Link>
              <Badge color="red" variant="light" size="lg">
                Partner: Mohamed Al-Rashid
              </Badge>
            </Group>
          </Group>
        </Container>
      </header>

      <Container size="xl" className="py-8">
        {/* Stats Cards */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg" className="mb-8">
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed">Total Affiliates</Text>
              <IconUsers size={20} className="text-primary" />
            </Group>
            <Title order={2} className="text-gray-900">{stats.totalAffiliates}</Title>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed">Total Clients</Text>
              <IconUserPlus size={20} className="text-primary" />
            </Group>
            <Title order={2} className="text-gray-900">{stats.totalClients}</Title>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed">Total Trades</Text>
              <IconChartLine size={20} className="text-primary" />
            </Group>
            <Title order={2} className="text-gray-900">{stats.totalTrades}</Title>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed">Total Volume</Text>
              <IconCurrencyDollar size={20} className="text-primary" />
            </Group>
            <Title order={2} className="text-gray-900">${stats.totalVolume.toFixed(2)}</Title>
          </Card>
        </SimpleGrid>

        {/* Invite Affiliate Section */}
        <Paper shadow="sm" p="xl" radius="md" withBorder className="mb-8">
          <Title order={3} mb="lg" className="flex items-center gap-2">
            <IconLink size={24} className="text-primary" />
            Invite New Affiliate
          </Title>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            <TextInput
              label="Affiliate Name"
              placeholder="e.g. Mohamed"
              value={affiliateName}
              onChange={(e) => setAffiliateName(e.target.value)}
            />
            <TextInput
              label="Email Address"
              placeholder="e.g. mohamed@lynq.ae"
              value={affiliateEmail}
              onChange={(e) => setAffiliateEmail(e.target.value)}
            />
            <div className="flex items-end">
              <Button
                fullWidth
                color="red"
                onClick={handleCreateAffiliate}
                leftSection={<IconUserPlus size={18} />}
              >
                Generate Invite Link
              </Button>
            </div>
          </SimpleGrid>

          {generatedLink && (
            <Paper bg="gray.0" p="md" mt="lg" radius="md">
              <Group justify="space-between">
                <div className="flex-1">
                  <Text size="sm" c="dimmed" mb={4}>Referral Link:</Text>
                  <Text size="sm" className="font-mono break-all">{generatedLink}</Text>
                </div>
                <CopyButton value={generatedLink}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copied!' : 'Copy link'}>
                      <ActionIcon color={copied ? 'green' : 'red'} variant="light" onClick={copy} size="lg">
                        {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
            </Paper>
          )}
        </Paper>

        {/* Affiliates Table */}
        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Title order={3} mb="lg">My Affiliates</Title>

          {affiliates.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              No affiliates yet. Invite your first affiliate above!
            </Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Referral Link</Table.Th>
                  <Table.Th>Clients</Table.Th>
                  <Table.Th>Trades</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {affiliates.map((affiliate) => (
                  <Table.Tr key={affiliate.id}>
                    <Table.Td>{affiliate.name}</Table.Td>
                    <Table.Td>{affiliate.email}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Text size="xs" className="font-mono text-gray-500">
                          /trade/{affiliate.referralCode.slice(0, 8)}...
                        </Text>
                        <CopyButton value={`${typeof window !== 'undefined' ? window.location.origin : ''}/trade/${affiliate.referralCode}`}>
                          {({ copied, copy }) => (
                            <ActionIcon size="xs" color={copied ? 'green' : 'gray'} variant="subtle" onClick={copy}>
                              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                            </ActionIcon>
                          )}
                        </CopyButton>
                      </Group>
                    </Table.Td>
                    <Table.Td>{getClientCount(affiliate.id)}</Table.Td>
                    <Table.Td>{getTradeCount(affiliate.id)}</Table.Td>
                    <Table.Td>
                      <Badge color="green" variant="light">Active</Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </Container>
    </div>
  );
}
