'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Container, Group, Text, Badge, Paper, Select, NumberInput, Button, Table, Tabs, Loader, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowUp, IconArrowDown, IconRefresh, IconX } from '@tabler/icons-react';
import { createChart, CandlestickData, Time, IChartApi, ISeriesApi } from 'lightweight-charts';
import { getAffiliateByReferralCode, createClient, getClients, addTrade, updateTrade, getTrades } from '@/lib/store';
import { DerivClient } from '@/lib/deriv';
import { Trade, CandleData } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface OpenPosition {
  contractId: number;
  symbol: string;
  direction: 'CALL' | 'PUT';
  entryPrice: number;
  currentPrice: number;
  profit: number;
  buyPrice: number;
  payout: number;
  startTime: number;
}

export default function TradingPage() {
  const params = useParams();
  const referralCode = params.referralCode as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [affiliateName, setAffiliateName] = useState('Unknown');
  const [clientId, setClientId] = useState('');
  const [balance, setBalance] = useState(10000);
  const [accountId, setAccountId] = useState('');
  const [accountType, setAccountType] = useState('');

  const [symbol, setSymbol] = useState('');
  const [availableSymbols, setAvailableSymbols] = useState<Array<{ value: string; label: string }>>([]);
  const [amount, setAmount] = useState<number>(10);
  const [duration, setDuration] = useState<number>(1);
  const [durationUnit, setDurationUnit] = useState<string>('m');
  const [currentPrice, setCurrentPrice] = useState<number>(0);

  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [isBuying, setIsBuying] = useState(false);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const derivClientRef = useRef<DerivClient | null>(null);

  // Initialize client and connection
  useEffect(() => {
    const init = async () => {
      try {
        // Look up affiliate
        const affiliate = getAffiliateByReferralCode(referralCode);
        if (affiliate) {
          setAffiliateName(affiliate.name);
        }

        // Create or find existing client for this session
        let client = getClients().find(c => c.referralCode === referralCode);
        if (!client) {
          client = createClient(referralCode);
        }
        setClientId(client.id);

        // Connect to Deriv
        const derivClient = new DerivClient();
        derivClientRef.current = derivClient;

        await derivClient.connect();
        setIsConnected(true);

        // Get initial balance
        const balanceRes = await derivClient.getBalance(true);
        setBalance(balanceRes.balance.balance);
        setAccountId(balanceRes.balance.loginid);
        setAccountType(derivClient.getAccountType(balanceRes.balance.loginid));

        console.log('Account:', balanceRes.balance.loginid, 'Type:', derivClient.getAccountType(balanceRes.balance.loginid));

        // Subscribe to balance updates
        derivClient.subscribeToBalance((data) => {
          setBalance(data.balance.balance);
        });

        // Get available symbols for this account (only open markets)
        const activeSymbols = await derivClient.getActiveSymbols();
        const openSymbols = activeSymbols.filter(s => s.isOpen);

        console.log('Available symbols:', activeSymbols.length, 'Open symbols:', openSymbols.length);

        // Filter to synthetic indices first (24/7 markets)
        const syntheticSymbols = openSymbols
          .filter(s => s.market === 'synthetic_index')
          .map(s => ({ value: s.symbol, label: s.display_name }));

        // If no synthetic indices, try forex (only open ones)
        let symbolsToUse = syntheticSymbols;
        if (syntheticSymbols.length === 0) {
          symbolsToUse = openSymbols
            .filter(s => s.market === 'forex')
            .slice(0, 10)
            .map(s => ({ value: s.symbol, label: s.display_name }));
        }

        // If still nothing, use any open market
        if (symbolsToUse.length === 0) {
          symbolsToUse = openSymbols
            .slice(0, 15)
            .map(s => ({ value: s.symbol, label: s.display_name }));
        }

        // If absolutely nothing is open, show warning
        if (symbolsToUse.length === 0) {
          notifications.show({
            title: 'No Markets Available',
            message: 'All markets are currently closed. Please try again later.',
            color: 'yellow',
          });
        }

        setAvailableSymbols(symbolsToUse);

        // Use first available symbol
        const defaultSymbol = symbolsToUse[0]?.value || 'R_100';
        setSymbol(defaultSymbol);

        // Get tick history for chart
        const history = await derivClient.getTickHistory(defaultSymbol, 100, 60);
        initChart(history);

        // Subscribe to live ticks
        derivClient.subscribeTicks(defaultSymbol, (data) => {
          setCurrentPrice(data.tick.quote);
          updateChart(data.tick.epoch, data.tick.quote);
        });

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize:', err);
        notifications.show({
          title: 'Connection Error',
          message: 'Failed to connect to trading server. Please refresh.',
          color: 'red',
        });
        setIsLoading(false);
      }
    };

    init();

    return () => {
      if (derivClientRef.current) {
        derivClientRef.current.disconnect();
      }
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [referralCode]);

  // Initialize chart
  const initChart = (history: CandleData[]) => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: '#1A1A2E' },
        textColor: '#A1A1AA',
      },
      grid: {
        vertLines: { color: 'rgba(255, 68, 79, 0.1)' },
        horzLines: { color: 'rgba(255, 68, 79, 0.1)' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 68, 79, 0.2)',
      },
      timeScale: {
        borderColor: 'rgba(255, 68, 79, 0.2)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#16A34A',
      downColor: '#FF444F',
      borderUpColor: '#16A34A',
      borderDownColor: '#FF444F',
      wickUpColor: '#16A34A',
      wickDownColor: '#FF444F',
    });

    const formattedData: CandlestickData[] = history.map(c => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeries.setData(formattedData);
    chart.timeScale().fitContent();

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);
  };

  // Update chart with new tick
  const lastCandleRef = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);

  const updateChart = (epoch: number, price: number) => {
    if (!candleSeriesRef.current) return;

    const candleTime = Math.floor(epoch / 60) * 60; // Round to minute

    if (lastCandleRef.current && lastCandleRef.current.time === candleTime) {
      // Update existing candle
      lastCandleRef.current.high = Math.max(lastCandleRef.current.high, price);
      lastCandleRef.current.low = Math.min(lastCandleRef.current.low, price);
      lastCandleRef.current.close = price;

      candleSeriesRef.current.update({
        time: candleTime as Time,
        open: lastCandleRef.current.open,
        high: lastCandleRef.current.high,
        low: lastCandleRef.current.low,
        close: lastCandleRef.current.close,
      });
    } else {
      // New candle
      lastCandleRef.current = {
        time: candleTime,
        open: price,
        high: price,
        low: price,
        close: price,
      };

      candleSeriesRef.current.update({
        time: candleTime as Time,
        open: price,
        high: price,
        low: price,
        close: price,
      });
    }
  };

  // Change symbol
  const handleSymbolChange = async (newSymbol: string | null) => {
    if (!newSymbol || !derivClientRef.current) return;

    // Unsubscribe from old symbol
    await derivClientRef.current.unsubscribeTicks(symbol);

    setSymbol(newSymbol);

    // Get history for new symbol
    const history = await derivClientRef.current.getTickHistory(newSymbol, 100, 60);

    // Reinitialize chart
    if (chartRef.current) {
      chartRef.current.remove();
    }
    lastCandleRef.current = null;
    initChart(history);

    // Subscribe to new symbol
    derivClientRef.current.subscribeTicks(newSymbol, (data) => {
      setCurrentPrice(data.tick.quote);
      updateChart(data.tick.epoch, data.tick.quote);
    });
  };

  // Execute trade
  const executeTrade = async (direction: 'CALL' | 'PUT') => {
    if (!derivClientRef.current || isBuying || !symbol) return;

    setIsBuying(true);

    try {
      // Get proposal
      const proposal = await derivClientRef.current.getProposal({
        symbol,
        amount,
        contractType: direction,
        duration,
        durationUnit: durationUnit as 's' | 'm' | 'h' | 't',
      });

      // Buy
      const buyResponse = await derivClientRef.current.buy(
        proposal.proposal.id,
        proposal.proposal.ask_price
      );

      // Add to open positions
      const position: OpenPosition = {
        contractId: buyResponse.buy.contract_id,
        symbol,
        direction,
        entryPrice: currentPrice,
        currentPrice,
        profit: 0,
        buyPrice: buyResponse.buy.buy_price,
        payout: buyResponse.buy.payout,
        startTime: buyResponse.buy.start_time,
      };
      setOpenPositions(prev => [...prev, position]);

      // Log trade to store
      const trade: Trade = {
        id: uuidv4(),
        accountId: clientId,
        accountType: 'client',
        contractId: buyResponse.buy.contract_id,
        contractType: direction,
        symbol,
        amount,
        buyPrice: buyResponse.buy.buy_price,
        timestamp: new Date(),
        status: 'open',
      };
      addTrade(trade);

      // Subscribe to contract updates
      derivClientRef.current.subscribeToContract(buyResponse.buy.contract_id, (update) => {
        const poc = update.proposal_open_contract;

        setOpenPositions(prev =>
          prev.map(p =>
            p.contractId === poc.contract_id
              ? { ...p, currentPrice: poc.current_spot, profit: poc.profit }
              : p
          )
        );

        if (poc.is_sold || poc.status === 'sold' || poc.status === 'won' || poc.status === 'lost') {
          // Contract closed
          setOpenPositions(prev => prev.filter(p => p.contractId !== poc.contract_id));

          // Update trade in store
          updateTrade(poc.contract_id, {
            sellPrice: poc.exit_tick,
            profit: poc.profit,
            status: poc.status === 'won' ? 'won' : poc.status === 'lost' ? 'lost' : 'sold',
          });

          // Refresh trade history
          setTradeHistory(getTrades().filter(t => t.accountId === clientId));

          derivClientRef.current?.unsubscribeFromContract(poc.contract_id);
        }
      });

      notifications.show({
        title: 'Trade Executed',
        message: `${direction === 'CALL' ? 'RISE' : 'FALL'} trade placed on ${symbol}`,
        color: direction === 'CALL' ? 'green' : 'red',
      });

      // Update balance
      setBalance(buyResponse.buy.balance_after);
    } catch (err: any) {
      notifications.show({
        title: 'Trade Failed',
        message: err.message || 'Failed to execute trade',
        color: 'red',
      });
    } finally {
      setIsBuying(false);
    }
  };

  // Sell position early
  const sellPosition = async (contractId: number) => {
    if (!derivClientRef.current) return;

    try {
      await derivClientRef.current.sell(contractId, 0);
      notifications.show({
        title: 'Position Closed',
        message: 'Trade sold successfully',
        color: 'blue',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Sell Failed',
        message: err.message || 'Failed to sell position',
        color: 'red',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="text-center">
          <Loader color="red" size="xl" />
          <Text c="dimmed" mt="md">Connecting to trading server...</Text>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Header */}
      <header className="border-b border-[rgba(255,68,79,0.15)] bg-[#161620]">
        <Container size="xl" className="py-3">
          <Group justify="space-between">
            <Group>
              <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                <span className="text-white font-bold">L</span>
              </div>
              <Text c="white" fw={600}>LunarGraph Trading</Text>
            </Group>
            <Group>
              <Badge color="blue" variant="light">
                Referred by: {affiliateName}
              </Badge>
              <Group gap={6}>
                <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
                <Text size="sm" c="dimmed">{isConnected ? 'Connected' : 'Disconnected'}</Text>
              </Group>
              <Badge color="gray" variant="light" size="lg" title={accountType}>
                {accountId}
              </Badge>
              {accountType && !accountType.includes('Synthetics') && (
                <Badge color="yellow" variant="light" size="sm">
                  Limited Markets
                </Badge>
              )}
              <Badge color="green" variant="filled" size="lg">
                ${balance.toFixed(2)}
              </Badge>
            </Group>
          </Group>
        </Container>
      </header>

      <Container size="xl" className="py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Main Chart Area */}
          <div className="col-span-9">
            <Paper className="panel-dark p-4">
              {/* Symbol and Price */}
              <Group justify="space-between" mb="md">
                <Group>
                  <Select
                    value={symbol}
                    onChange={handleSymbolChange}
                    data={availableSymbols}
                    styles={{
                      input: { backgroundColor: '#0A0A0F', borderColor: 'rgba(255,68,79,0.2)', color: 'white' },
                      dropdown: { backgroundColor: '#161620', borderColor: 'rgba(255,68,79,0.2)' },
                      option: { color: 'white' },
                    }}
                  />
                  <Title order={2} c="white">{currentPrice.toFixed(2)}</Title>
                </Group>
                <Button
                  variant="subtle"
                  color="gray"
                  leftSection={<IconRefresh size={16} />}
                  onClick={() => window.location.reload()}
                >
                  Refresh
                </Button>
              </Group>

              {/* Chart */}
              <div ref={chartContainerRef} className="chart-container" style={{ height: 400 }} />
            </Paper>

            {/* Positions & History Tabs */}
            <Paper className="panel-dark p-4 mt-4">
              <Tabs defaultValue="positions" color="red">
                <Tabs.List>
                  <Tabs.Tab value="positions">
                    Open Positions ({openPositions.length})
                  </Tabs.Tab>
                  <Tabs.Tab value="history">
                    Trade History
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="positions" pt="md">
                  {openPositions.length === 0 ? (
                    <Text c="dimmed" ta="center" py="xl">No open positions</Text>
                  ) : (
                    <Table className="table-dark">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Symbol</Table.Th>
                          <Table.Th>Direction</Table.Th>
                          <Table.Th>Entry</Table.Th>
                          <Table.Th>Current</Table.Th>
                          <Table.Th>Profit/Loss</Table.Th>
                          <Table.Th>Action</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {openPositions.map((pos) => (
                          <Table.Tr key={pos.contractId}>
                            <Table.Td>{pos.symbol}</Table.Td>
                            <Table.Td>
                              <Badge color={pos.direction === 'CALL' ? 'green' : 'red'}>
                                {pos.direction === 'CALL' ? 'RISE' : 'FALL'}
                              </Badge>
                            </Table.Td>
                            <Table.Td>{pos.entryPrice.toFixed(2)}</Table.Td>
                            <Table.Td>{pos.currentPrice.toFixed(2)}</Table.Td>
                            <Table.Td>
                              <Text c={pos.profit >= 0 ? 'green' : 'red'} fw={600}>
                                {pos.profit >= 0 ? '+' : ''}{pos.profit.toFixed(2)}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Button
                                size="xs"
                                color="red"
                                variant="subtle"
                                leftSection={<IconX size={14} />}
                                onClick={() => sellPosition(pos.contractId)}
                              >
                                Sell
                              </Button>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  )}
                </Tabs.Panel>

                <Tabs.Panel value="history" pt="md">
                  {tradeHistory.length === 0 ? (
                    <Text c="dimmed" ta="center" py="xl">No trade history</Text>
                  ) : (
                    <Table className="table-dark">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Time</Table.Th>
                          <Table.Th>Symbol</Table.Th>
                          <Table.Th>Type</Table.Th>
                          <Table.Th>Buy Price</Table.Th>
                          <Table.Th>Sell Price</Table.Th>
                          <Table.Th>Profit</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {tradeHistory.slice(0, 20).map((trade) => (
                          <Table.Tr key={trade.id}>
                            <Table.Td>{new Date(trade.timestamp).toLocaleTimeString()}</Table.Td>
                            <Table.Td>{trade.symbol}</Table.Td>
                            <Table.Td>
                              <Badge color={trade.contractType === 'CALL' ? 'green' : 'red'} variant="light">
                                {trade.contractType === 'CALL' ? 'RISE' : 'FALL'}
                              </Badge>
                            </Table.Td>
                            <Table.Td>${trade.buyPrice?.toFixed(2)}</Table.Td>
                            <Table.Td>${trade.sellPrice?.toFixed(2) || '-'}</Table.Td>
                            <Table.Td>
                              <Text c={(trade.profit || 0) >= 0 ? 'green' : 'red'} fw={600}>
                                {(trade.profit || 0) >= 0 ? '+' : ''}${(trade.profit || 0).toFixed(2)}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  )}
                </Tabs.Panel>
              </Tabs>
            </Paper>
          </div>

          {/* Trade Panel */}
          <div className="col-span-3">
            <Paper className="panel-dark p-4">
              <Title order={4} c="white" mb="md">Place Trade</Title>

              <div className="space-y-4">
                <div>
                  <Text size="sm" c="dimmed" mb={4}>Amount ($)</Text>
                  <NumberInput
                    value={amount}
                    onChange={(val) => setAmount(typeof val === 'number' ? val : 10)}
                    min={1}
                    max={1000}
                    step={5}
                    styles={{
                      input: { backgroundColor: '#0A0A0F', borderColor: 'rgba(255,68,79,0.2)', color: 'white' },
                    }}
                  />
                </div>

                <div>
                  <Text size="sm" c="dimmed" mb={4}>Duration</Text>
                  <Group grow>
                    <NumberInput
                      value={duration}
                      onChange={(val) => setDuration(typeof val === 'number' ? val : 1)}
                      min={1}
                      max={60}
                      styles={{
                        input: { backgroundColor: '#0A0A0F', borderColor: 'rgba(255,68,79,0.2)', color: 'white' },
                      }}
                    />
                    <Select
                      value={durationUnit}
                      onChange={(val) => setDurationUnit(val || 'm')}
                      data={[
                        { value: 't', label: 'Ticks' },
                        { value: 's', label: 'Sec' },
                        { value: 'm', label: 'Min' },
                        { value: 'h', label: 'Hour' },
                      ]}
                      styles={{
                        input: { backgroundColor: '#0A0A0F', borderColor: 'rgba(255,68,79,0.2)', color: 'white' },
                        dropdown: { backgroundColor: '#161620', borderColor: 'rgba(255,68,79,0.2)' },
                      }}
                    />
                  </Group>
                </div>

                <div className="pt-4 space-y-3">
                  <Button
                    fullWidth
                    size="xl"
                    className="btn-buy"
                    leftSection={<IconArrowUp size={24} />}
                    onClick={() => executeTrade('CALL')}
                    loading={isBuying}
                    disabled={isBuying || !symbol}
                  >
                    RISE / BUY
                  </Button>

                  <Button
                    fullWidth
                    size="xl"
                    className="btn-sell"
                    leftSection={<IconArrowDown size={24} />}
                    onClick={() => executeTrade('PUT')}
                    loading={isBuying}
                    disabled={isBuying || !symbol}
                  >
                    FALL / SELL
                  </Button>
                </div>

                <Paper bg="rgba(255,68,79,0.1)" p="sm" radius="md" mt="md">
                  <Text size="xs" c="dimmed">Current Price</Text>
                  <Title order={3} c="white">{currentPrice.toFixed(2)}</Title>
                </Paper>
              </div>
            </Paper>
          </div>
        </div>
      </Container>
    </div>
  );
}
