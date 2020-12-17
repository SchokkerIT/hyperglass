import { useEffect, useMemo } from 'react';
import { Button, Stack, Text, VStack } from '@chakra-ui/react';
import { useQuery } from 'react-query';
import { FiArrowRightCircle as RightArrow } from '@meronex/icons/fi';
import { useConfig, useColorValue, useGlobalState } from '~/context';
import { useStrf, useLGState } from '~/hooks';

import type { DnsOverHttps } from '~/types';
import type { TResolvedTarget } from './types';

function findAnswer(data: DnsOverHttps.Response | undefined): string {
  let answer = '';
  if (typeof data !== 'undefined') {
    answer = data?.Answer?.filter(answerData => answerData.type === data?.Question[0]?.type)[0]
      ?.data;
  }
  return answer;
}

export const ResolvedTarget = (props: TResolvedTarget) => {
  const { setTarget } = props;
  const { web } = useConfig();
  const { isSubmitting } = useGlobalState();
  const { fqdnTarget, queryTarget, families, formData } = useLGState();

  const color = useColorValue('secondary.500', 'secondary.300');

  const dnsUrl = web.dns_provider.url;
  const query4 = Array.from(families.value).includes(4);
  const query6 = Array.from(families.value).includes(6);

  const tooltip4 = useStrf(web.text.fqdn_tooltip, { protocol: 'IPv4' });
  const tooltip6 = useStrf(web.text.fqdn_tooltip, { protocol: 'IPv6' });
  const [messageStart, messageEnd] = useMemo(() => web.text.fqdn_message.split('{fqdn}'), [
    web.text.fqdn_message,
  ]);

  const { data: data4, isLoading: isLoading4, isError: isError4 } = useQuery(
    [fqdnTarget.value, 4],
    dnsQuery,
  );

  const { data: data6, isLoading: isLoading6, isError: isError6 } = useQuery(
    [fqdnTarget.value, 6],
    dnsQuery,
  );
  async function dnsQuery(
    target: string,
    family: 4 | 6,
  ): Promise<DnsOverHttps.Response | undefined> {
    let json;
    const type = family === 4 ? 'A' : family === 6 ? 'AAAA' : '';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(`${dnsUrl}?name=${target}&type=${type}`, {
      headers: { accept: 'application/dns-json' },
      signal: controller.signal,
      mode: 'cors',
    });
    json = await res.json();
    clearTimeout(timeout);
    return json;
  }

  function handleOverride(value: string): void {
    setTarget({ field: 'query_target', value });
  }
  function selectTarget(value: string): void {
    formData.set(p => ({ ...p, query_target: value }));
    isSubmitting.set(true);
  }

  useEffect(() => {
    if (query6 && data6?.Answer) {
      handleOverride(findAnswer(data6));
    } else if (query4 && data4?.Answer && !query6 && !data6?.Answer) {
      handleOverride(findAnswer(data4));
    } else if (query4 && data4?.Answer) {
      handleOverride(findAnswer(data4));
    }
  }, [data4, data6]);

  return (
    <VStack w="100%" spacing={4} justify="center">
      <Text fontSize="sm" textAlign="center">
        {messageStart}
        <Text as="span" fontSize="sm" fontWeight="bold" color={color}>
          {fqdnTarget.value}
        </Text>
        {messageEnd}
      </Text>
      <Stack spacing={2}>
        {!isLoading4 && !isError4 && query4 && findAnswer(data4) && (
          <Button
            size="sm"
            fontSize="xs"
            colorScheme="primary"
            justifyContent="space-between"
            rightIcon={<RightArrow size="18px" />}
            title={tooltip4}
            fontFamily="mono"
            onClick={() => selectTarget(findAnswer(data4))}>
            {findAnswer(data4)}
          </Button>
        )}
        {!isLoading6 && !isError6 && query6 && findAnswer(data6) && (
          <Button
            size="sm"
            fontSize="xs"
            colorScheme="secondary"
            justifyContent="space-between"
            rightIcon={<RightArrow size="18px" />}
            title={tooltip6}
            fontFamily="mono"
            onClick={() => selectTarget(findAnswer(data6))}>
            {findAnswer(data6)}
          </Button>
        )}
      </Stack>
    </VStack>
  );
};
