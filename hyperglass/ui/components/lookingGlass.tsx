import { useEffect, useMemo } from 'react';
import { Flex } from '@chakra-ui/react';
import { FormProvider, useForm } from 'react-hook-form';
import { intersectionWith } from 'lodash';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  If,
  AnimatedForm,
  FormRow,
  QueryVrf,
  FormField,
  HelpModal,
  QueryType,
  QueryTarget,
  SubmitButton,
  QueryLocation,
  CommunitySelect,
} from '~/components';
import { useConfig } from '~/context';
import { useStrf, useGreeting, useDevice, useLGState } from '~/hooks';
import { isQueryType, isString } from '~/types';

import type { TFormData, TDeviceVrf, OnChangeArgs } from '~/types';

const fqdnPattern = /^(?!:\/\/)([a-zA-Z0-9-]+\.)?[a-zA-Z0-9-][a-zA-Z0-9-]+\.[a-zA-Z-]{2,6}?$/gim;

export const HyperglassForm = () => {
  const { web, content, messages, queries } = useConfig();

  const [greetingAck, setGreetingAck] = useGreeting();
  const getDevice = useDevice();

  const noQueryType = useStrf(messages.no_input, { field: web.text.query_type });
  const noQueryLoc = useStrf(messages.no_input, { field: web.text.query_location });
  const noQueryTarget = useStrf(messages.no_input, { field: web.text.query_target });

  const formSchema = yup.object().shape({
    query_location: yup.array().of(yup.string()).required(noQueryLoc),
    query_type: yup.string().required(noQueryType),
    query_vrf: yup.string(),
    query_target: yup.string().required(noQueryTarget),
  });

  const formInstance = useForm<TFormData>({
    resolver: yupResolver(formSchema),
    defaultValues: { query_vrf: 'default', query_target: '', query_location: [], query_type: '' },
  });
  const { handleSubmit, register, unregister, setValue, errors } = formInstance;

  const {
    queryVrf,
    families,
    formData,
    queryType,
    availVrfs,
    fqdnTarget,
    btnLoading,
    queryTarget,
    isSubmitting,
    resolvedOpen,
    queryLocation,
  } = useLGState();

  function submitHandler(values: TFormData) {
    if (!greetingAck && web.greeting.required) {
      window.location.reload(false);
      setGreetingAck(false);
    } else if (fqdnPattern.test(values.query_target)) {
      btnLoading.set(true);
      fqdnTarget.set(values.query_target);
      formData.set(values);
      resolvedOpen();
    } else {
      formData.set(values);
      isSubmitting.set(true);
    }
  }

  function handleLocChange(locations: string[]): void {
    const allVrfs = [] as TDeviceVrf[][];

    queryLocation.set(locations);

    // Create an array of each device's VRFs.
    for (const loc of locations) {
      const device = getDevice(loc);
      allVrfs.push(device.vrfs);
    }

    // Use _.intersectionWith to create an array of VRFs common to all selected locations.
    const intersecting = intersectionWith(
      ...allVrfs,
      (a: TDeviceVrf, b: TDeviceVrf) => a.id === b.id,
    );

    availVrfs.set(intersecting);

    // If there are no intersecting VRFs, use the default VRF.
    if (
      intersecting.filter(i => i.id === queryVrf.value).length === 0 &&
      queryVrf.value !== 'default'
    ) {
      queryVrf.set('default');
    }

    let ipv4 = 0;
    let ipv6 = 0;

    if (intersecting.length !== 0) {
      for (const intersection of intersecting) {
        if (intersection.ipv4) {
          ipv4++;
        }
        if (intersection.ipv6) {
          ipv6++;
        }
      }
    }

    if (ipv4 !== 0 && ipv4 === ipv6) {
      families.set([4, 6]);
    } else if (ipv4 > ipv6) {
      families.set([4]);
    } else if (ipv4 < ipv6) {
      families.set([6]);
    } else {
      families.set([]);
    }
  }

  function handleChange(e: OnChangeArgs): void {
    setValue(e.field, e.value);

    if (e.field === 'query_location' && Array.isArray(e.value)) {
      handleLocChange(e.value);
    } else if (e.field === 'query_type' && isQueryType(e.value)) {
      queryType.set(e.value);
    } else if (e.field === 'query_vrf' && isString(e.value)) {
      queryVrf.set(e.value);
    } else if (e.field === 'query_target' && isString(e.value)) {
      queryTarget.set(e.value);
    }
  }

  const vrfContent = useMemo(() => {
    if (Object.keys(content.vrf).includes(queryVrf.value) && queryType.value !== '') {
      return content.vrf[queryVrf.value][queryType.value];
    }
  }, [queryVrf]);

  const isFqdnQuery = useMemo(() => {
    return ['bgp_route', 'ping', 'traceroute'].includes(queryType.value);
  }, [queryType.value]);

  useEffect(() => {
    register({ name: 'query_location', required: true });
    register({ name: 'query_type', required: true });
    register({ name: 'query_vrf' });
    register({ name: 'query_target', required: true });
  }, [register]);

  return (
    <FormProvider {...formInstance}>
      <AnimatedForm
        p={0}
        my={4}
        w="100%"
        mx="auto"
        textAlign="left"
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        exit={{ opacity: 0, x: -300 }}
        initial={{ opacity: 0, y: 300 }}
        maxW={{ base: '100%', lg: '75%' }}
        onSubmit={handleSubmit(submitHandler)}>
        <FormRow>
          <FormField name="query_location" label={web.text.query_location}>
            <QueryLocation onChange={handleChange} label={web.text.query_location} />
          </FormField>
          <FormField
            name="query_type"
            label={web.text.query_type}
            labelAddOn={vrfContent && <HelpModal item={vrfContent} name="query_type" />}>
            <QueryType onChange={handleChange} label={web.text.query_type} />
          </FormField>
        </FormRow>
        <FormRow>
          <If c={availVrfs.length > 1}>
            <FormField label={web.text.query_vrf} name="query_vrf">
              <QueryVrf label={web.text.query_vrf} vrfs={availVrfs.value} onChange={handleChange} />
            </FormField>
          </If>
          <FormField name="query_target" label={web.text.query_target}>
            <If c={queryType.value === 'bgp_community' && queries.bgp_community.mode === 'select'}>
              <CommunitySelect
                name="query_target"
                register={register}
                unregister={unregister}
                onChange={handleChange}
                communities={queries.bgp_community.communities}
              />
            </If>
            <If
              c={!(queryType.value === 'bgp_community' && queries.bgp_community.mode === 'select')}>
              <QueryTarget
                name="query_target"
                register={register}
                setTarget={handleChange}
                resolveTarget={isFqdnQuery}
                placeholder={web.text.query_target}
              />
            </If>
          </FormField>
        </FormRow>
        <FormRow mt={0} justifyContent="flex-end">
          <Flex
            my={2}
            w="100%"
            ml="auto"
            maxW="100%"
            flex="0 0 0"
            flexDir="column"
            mr={{ base: 0, lg: 2 }}>
            <SubmitButton handleChange={handleChange} />
          </Flex>
        </FormRow>
      </AnimatedForm>
    </FormProvider>
  );
};