import React, { useState } from 'react';
import { Button, Input, Typography, Table, Tag, Spin, Card, Collapse, Toast, Space } from '@douyinfe/semi-ui';
import { IconSearch, IconCopy, IconDownload } from '@douyinfe/semi-icons';
import { IconTag } from '@douyinfe/semi-icons-lab';
import { API, timestamp2string, copy } from '../helpers';
import { stringToColor } from '../helpers/render';
import { ITEMS_PER_PAGE } from '../constants';
import { renderModelPrice, renderQuota } from '../helpers/render';
import Paragraph from '@douyinfe/semi-ui/lib/es/typography/paragraph';
import { Tooltip, Modal } from '@douyinfe/semi-ui';
import Papa from 'papaparse';

const { Text } = Typography;
const { Panel } = Collapse;

function renderTimestamp(timestamp) {
    return timestamp2string(timestamp);
}

function renderIsStream(bool) {
    if (bool) {
        return <Tag color="blue" size="large">流</Tag>;
    } else {
        return <Tag color="purple" size="large">非流</Tag>;
    }
}

function renderUseTime(type) {
    const time = parseInt(type);
    if (time < 101) {
        return <Tag color="green" size="large"> {time} s </Tag>;
    } else if (time < 300) {
        return <Tag color="orange" size="large"> {time} s </Tag>;
    } else {
        return <Tag color="red" size="large"> {time} s </Tag>;
    }
}

const KeyUsage = () => {
    const [key, setKey] = useState('');
    const [balance, setBalance] = useState(0);
    const [usage, setUsage] = useState(0);
    const [accessdate, setAccessDate] = useState(0);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeKeys, setActiveKeys] = useState([]);
    const [tokenValid, setTokenValid] = useState(false);

    const resetData = () => {
        setBalance("未知");
        setUsage("未知");
        setAccessDate("未知");
        setLogs([]);
        setTokenValid(false);
    };

    const fetchData = async () => {
        if (key === '') {
            Toast.warning('请先输入令牌，再进行查询');
            return;
        }
        setLoading(true);
        try {
            if (process.env.REACT_APP_SHOW_BALANCE === "true") {
                const subscription = await API.get(`${process.env.REACT_APP_BASE_URL}/v1/dashboard/billing/subscription`, {
                    headers: { Authorization: `Bearer ${key}` },
                });
                const subscriptionData = subscription.data;
                setBalance(subscriptionData.hard_limit_usd);
                setTokenValid(true);

                let now = new Date();
                let start = new Date(now.getTime() - 100 * 24 * 3600 * 1000);
                let start_date = start.getFullYear() + '-' + (start.getMonth() + 1) + '-' + start.getDate();
                let end_date = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
                const res = await API.get(`${process.env.REACT_APP_BASE_URL}/v1/dashboard/billing/usage?start_date=${start_date}&end_date=${end_date}`, {
                    headers: { Authorization: `Bearer ${key}` },
                });
                const data = res.data;
                setUsage(data.total_usage / 100);
            }

            if (process.env.REACT_APP_SHOW_DETAIL === "true") {
                const logRes = await API.get(`${process.env.REACT_APP_BASE_URL}/api/log/token?key=${key}`);
                const { success, message, data: logData } = logRes.data;
                if (success) {
                    setLogs(logData.reverse());
                    let quota = 0;
                    for (let i = 0; i < logData.length; i++) {
                        quota += logData[i].quota;
                    }
                    setActiveKeys(['1', '2']); // 自动展开两个折叠面板
                } else {
                    Toast.error('查询调用详情失败，请输入正确的令牌');
                }
            }
            setLoading(false);
        } catch (e) {
            Toast.error("查询失败，请输入正确的令牌");
            resetData(); // 如果发生错误，重置所有数据为默认值
            setLoading(false);
            return;
        }
    };

    const copyText = async (text) => {
        if (await copy(text)) {
            Toast.success('已复制：' + text);
        } else {
            Modal.error({ title: '无法复制到剪贴板，请手动复制', content: text });
        }
    };

    const columns = [
        {
            title: '时间',
            dataIndex: 'created_at',
            render: renderTimestamp,
            sorter: (a, b) => a.created_at - b.created_at,
        },
        {
            title: '模型',
            dataIndex: 'model_name',
            render: (text, record, index) => {
                return record.type === 0 || record.type === 2 ? (
                    <div>
                        <Tag
                            color={stringToColor(text)}
                            size="large"
                            onClick={() => {
                                copyText(text);
                            }}
                        >
                            {' '}
                            {text}{' '}
                        </Tag>
                    </div>
                ) : (
                    <></>
                );
            },
            sorter: (a, b) => ('' + a.model_name).localeCompare(b.model_name),
        },
        {
            title: '用时',
            dataIndex: 'use_time',
            render: (text, record, index) => {
                return (
                    <div>
                        <Space>
                            {renderUseTime(text)}
                            {renderIsStream(record.is_stream)}
                        </Space>
                    </div>
                );
            },
            sorter: (a, b) => a.use_time - b.use_time,
        },
        {
            title: '提示',
            dataIndex: 'prompt_tokens',
            render: (text, record, index) => {
                return record.type === 0 || record.type === 2 ? <div>{<span> {text} </span>}</div> : <></>;
            },
            sorter: (a, b) => a.prompt_tokens - b.prompt_tokens,
        },
        {
            title: '补全',
            dataIndex: 'completion_tokens',
            render: (text, record, index) => {
                return parseInt(text) > 0 && (record.type === 0 || record.type === 2) ? (
                    <div>{<span> {text} </span>}</div>
                ) : (
                    <></>
                );
            },
            sorter: (a, b) => a.completion_tokens - b.completion_tokens,
        },
        {
            title: '花费',
            dataIndex: 'quota',
            render: (text, record, index) => {
                return record.type === 0 || record.type === 2 ? <div>{renderQuota(text, 6)}</div> : <></>;
            },
            sorter: (a, b) => a.quota - b.quota,
        },
        {
            title: '详情',
            dataIndex: 'content',
            render: (text, record, index) => {
                if (record.other === '') {
                    record.other = '{}';
                }
                let other = JSON.parse(record.other);
                if (other == null) {
                    return (
                        <Paragraph
                            ellipsis={{
                                rows: 2,
                                showTooltip: {
                                    type: 'popover',
                                },
                            }}
                        >
                            {text}
                        </Paragraph>
                    );
                }
                let content = renderModelPrice(
                    record.prompt_tokens,
                    record.completion_tokens,
                    other.model_ratio,
                    other.model_price,
                    other.completion_ratio,
                    other.group_ratio,
                );
                return (
                    <Tooltip content={content}>
                        <Paragraph
                            ellipsis={{
                                rows: 2,
                            }}
                        >
                            {text}
                        </Paragraph>
                    </Tooltip>
                );
            },
        },
    ];

    const copyTokenInfo = (e) => {
        e.stopPropagation();
        const info = `令牌总额: ${balance === 100000000 ? '无限' : balance}
剩余额度: ${balance === 100000000 ? '无限制' : balance - usage}
已用额度: ${balance === 100000000 ? '不进行计算' : usage}`;
        copyText(info);
    };

    const exportCSV = (e) => {
        e.stopPropagation();
        const csvData = logs.map(log => ({
            '时间': renderTimestamp(log.created_at),
            '模型': log.model_name,
            '用时': log.use_time,
            '提示': log.prompt_tokens,
            '补全': log.completion_tokens,
            '花费': log.quota,
            '详情': log.content,
        }));
        const csvString = '\ufeff' + Papa.unparse(csvData);  // 使用PapaParse库来转换数据
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'data.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Card>
            <div style={{ marginBottom: 16 }}>
                <Input
                    showClear
                    value={key}
                    onChange={(value) => setKey(value)}
                    placeholder="请输入要查询的令牌（sk-xxx）"
                    prefix={<IconSearch />}
                    suffix={
                        <Button
                            onClick={fetchData}
                            loading={loading}
                        >
                            查询
                        </Button>
                    }
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            fetchData();
                        }
                    }}
                />
            </div>
            <Collapse activeKey={activeKeys} onChange={(keys) => {
                if (keys.length === 0) {
                    setActiveKeys(['1', '2']);
                } else {
                    setActiveKeys(keys);
                }
            }}>
                {process.env.REACT_APP_SHOW_BALANCE === "true" && (
                    <Panel
                        header="令牌信息"
                        itemKey="1"
                        extra={
                            <Button icon={<IconCopy />} theme='borderless' type='primary' onClick={(e) => copyTokenInfo(e)} disabled={!tokenValid}>
                                复制令牌信息
                            </Button>
                        }
                        disabled={!tokenValid}
                    >
                        <Spin spinning={loading}>
                            <div style={{ marginBottom: 16 }}>
                                <Text type="secondary">
                                    令牌总额：{balance === 100000000 ? "无限" : balance === "未知" ? "未知" : `$${balance}`}
                                </Text>
                                <br /><br />
                                <Text type="secondary">
                                    剩余额度：{balance === 100000000 ? "无限制" : balance === "未知" || usage === "未知" ? "未知" : `$${balance - usage}`}
                                </Text>
                                <br /><br />
                                <Text type="secondary">
                                    已用额度：{balance === 100000000 ? "不进行计算" : usage === "未知" ? "未知" : `$${usage}`}
                                </Text>
                                <br /><br />
                                <Text type="secondary">
                                    有效期至：{accessdate === 0 ? '永不过期' : accessdate === "未知" ? '未知' : renderTimestamp(accessdate)}
                                </Text>
                            </div>
                        </Spin>
                    </Panel>
                )}
                {process.env.REACT_APP_SHOW_DETAIL === "true" && (
                    <Panel
                        header="调用详情"
                        itemKey="2"
                        extra={
                            <Button icon={<IconDownload />} theme='borderless' type='primary' onClick={(e) => exportCSV(e)} disabled={!tokenValid || logs.length === 0}>
                                导出为CSV文件
                            </Button>
                        }
                        disabled={!tokenValid}
                    >
                        <Spin spinning={loading}>
                            <Table
                                columns={columns}
                                dataSource={logs}
                                pagination={{
                                    pageSize: ITEMS_PER_PAGE,
                                    hideOnSinglePage: true,
                                }}
                            />
                        </Spin>
                    </Panel>
                )}
            </Collapse>
        </Card>
    );
};

export default KeyUsage;
