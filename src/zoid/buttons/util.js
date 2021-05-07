/* @flow */
import { supportsPopups, isAndroid, isChrome, isIos, isSafari, isSFVC, type Experiment } from 'belter/src';
import { FUNDING } from '@paypal/sdk-constants/src';
import { getEnableFunding, createExperiment, getFundingEligibility } from '@paypal/sdk-client/src';

import type { Experiment as VenmoExperiment } from '../../types';
import { BUTTON_FLOW } from '../../constants';
import type { ApplePaySessionConfigRequest, ButtonProps } from '../../ui/buttons/props';

export function determineFlow(props : ButtonProps) : $Values<typeof BUTTON_FLOW> {

    if (props.createBillingAgreement) {
        return BUTTON_FLOW.BILLING_SETUP;
    } else if (props.createSubscription) {
        return BUTTON_FLOW.SUBSCRIPTION_SETUP;
    } else {
        return BUTTON_FLOW.PURCHASE;
    }
}

export function isSupportedNativeBrowser() : boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    if (!supportsPopups()) {
        return false;
    }

    if (isSFVC()) {
        return false;
    }

    if (isIos() && isSafari()) {
        return true;
    }

    if (isAndroid() && isChrome()) {
        return true;
    }

    return false;
}

export function createVenmoExperiment() : Experiment | void {
    const enableFunding = getEnableFunding();
    const isEnableFundingVenmo = enableFunding && enableFunding.indexOf(FUNDING.VENMO) !== -1;

    const fundingEligibility = getFundingEligibility();
    const isEligibleForVenmo = fundingEligibility && fundingEligibility[FUNDING.VENMO] && fundingEligibility[FUNDING.VENMO].eligible;

    // exclude buyers who are not eligible
    // exclude integrations using enable-funding=venmo
    if (!isEligibleForVenmo || isEnableFundingVenmo) {
        return;
    }

    if (isIos() && isSafari()) {
        return createExperiment('enable_venmo_ios', 25);
    }

    if (isAndroid() && isChrome()) {
        return createExperiment('enable_venmo_android', 25);
    }
}

export function getVenmoExperiment(experiment : ?Experiment) : VenmoExperiment {
    const enableFunding = getEnableFunding();
    const isEnableFundingVenmo = enableFunding && enableFunding.indexOf(FUNDING.VENMO) !== -1;
    const isExperimentEnabled = experiment && experiment.isEnabled();

    return {
        enableVenmo: Boolean(isExperimentEnabled || isEnableFundingVenmo)
    };
}

export function applePaySession() : ?ApplePaySessionConfigRequest {
    try {
        if (!window.ApplePaySession) {
            return;
        }

        return (version, request) => {
            const session = new window.ApplePaySession(version, request);
            const listeners = {};

            session.onvalidatemerchant = (e) => {
                listeners.validatemerchant(e.validationURL);
            };

            session.onpaymentmethodselected = () => {
                listeners.paymentmethodselected();
            };

            session.onshippingmethodselected = () => {
                listeners.shippingmethodselected();
            };

            session.onshippingcontactselected = () => {
                listeners.shippingcontactselected();
            };

            session.onpaymentauthorized = (e) => {
                listeners.paymentauthorized(e.payment);
            };

            session.oncancel = () => {
                listeners.cancel();
            };
                            
            return {
                addListener: (name, handler) => {
                    listeners[name] = handler;
                },
                completeMerchantValidation: (validatedSession) => {
                    session.completeMerchantValidation(validatedSession);
                },
                completePaymentMethodSelection: (update) => {
                    session.completePaymentMethodSelection(update);
                },
                completeShippingMethodSelection: (update) => {
                    session.completeShippingMethodSelection(update);
                },
                completeShippingContactSelection: (update) => {
                    session.completeShippingContactSelection(update);
                },
                completePayment: (result) => {
                    session.completePayment(result);
                },
                begin: () => session.begin()
            };
        };
    } catch (e) {
        return undefined;
    }
}
