import React from 'react'
import PropTypes from 'prop-types'
import GenericSection from './GenericSection'
import Button from '../elements/Button'
import { SectionProps } from '../../utils/SectionProps'

const propTypes = {
  children: PropTypes.node,
  ...SectionProps.types,
}

const defaultProps = {
  children: null,
  ...SectionProps.defaults,
}

const OpenSource = props => {
  return (
    <>
      <GenericSection {...props}>
        <div className="center-content">
          <div className="container-sm">
            <h2 className="section-header mt-0 mb-0 reveal-from-top" data-reveal-delay="150">
              Open Source Support:
            </h2>
            <div className="open-source reveal-from-top" data-reveal-delay="300">
              At HOPR we embrace and live the ethos of free and open source software. Especially when making claims
              about privacy, it's important that you can check and challenge every bit of our work.
              <br />
              <br />
              But we want to take it further: we support the vision of Web 3.0 as an open and collaborative ecosystem.
              Therefore, we walk the talk and contribute to a range of open source projects beyond our primary project,
              the HOPR protocol:
              <br />
              <br />
              <ul>
                <li>
                  <a className="underline" href="https://libp2p.io/" target="_blank" rel="noopener noreferrer">
                    Libp2p
                  </a>{' '}
                  is a fundamental building block for a range of decentralized projects such as Ethereum, Filecoin,
                  IPFS, Polkadot and many more. We've solved{' '}
                  <a
                    className="underline"
                    href="https://github.com/libp2p/js-peer-id/pull/115"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    several
                  </a>{' '}
                  <a
                    className="underline"
                    href="https://github.com/libp2p/js-libp2p/pull/608"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    issues
                  </a>{' '}
                  <a
                    className="underline"
                    href="https://github.com/libp2p/js-peer-id/pull/116"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    and
                  </a>{' '}
                  <a
                    className="underline"
                    href="https://github.com/libp2p/js-libp2p/pull/330"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    contributed
                  </a>{' '}
                  <a
                    className="underline"
                    href="https://github.com/libp2p/js-peer-info/pull/91"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    various
                  </a>{' '}
                  <a
                    className="underline"
                    href="https://github.com/libp2p/js-peer-info/pull/89"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    improvements
                  </a>
                  .
                </li>
                <li>
                  <a className="underline" href="https://multiformats.io/" target="_blank" rel="noopener noreferrer">
                    Multiformats
                  </a>{' '}
                  is a general-purpose value description format used by a range of decentralized networks to which we
                  contributed some{' '}
                  <a
                    href="https://github.com/multiformats/js-multiaddr/pull/112"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    fixes and testing
                  </a>
                  .
                </li>

                <li>
                  <a
                    href="https://github.com/dignifiedquire/pull-length-prefixed"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Pull-length-prefixed
                  </a>{' '}
                  is a data transmission mechanism for decentralized applications where we{' '}
                  <a
                    href="https://github.com/dignifiedquire/pull-length-prefixed/pull/20"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    resolved a critical issue
                  </a>
                  .
                </li>

                <li>
                  <a className="underline" href="http://definitelytyped.org/" target="_blank" rel="noopener noreferrer">
                    DefinitelyTyped
                  </a>{' '}
                  is a repository for TypeScript definitions used in over 3 million projects where we{' '}
                  <a
                    href="https://github.com/DefinitelyTyped/DefinitelyTyped/pull/42559"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    identified and resolved an implementation issue
                  </a>
                  .
                </li>
              </ul>
            </div>
          </div>
        </div>
      </GenericSection>
      <GenericSection {...props} id="documentantion" hasBgColor invertColor>
        <div className="center-content">
          <div className="container-sm">
            <h2 className="section-header mt-0 mb-0 reveal-from-top" data-reveal-delay="150">
              Documentation:
            </h2>
            <div className="description reveal-from-top" data-reveal-delay="300">
              Find out more on how to join the HOPR network, run your own node and dive deeper into how to BUIDL with
              HOPR.
            </div>
            <Button
              color={props.invertColor ? 'secondary' : 'primary'}
              tag="a"
              href="http://docs.hoprnet.io/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Hosted at gitbook
            </Button>
          </div>
        </div>
      </GenericSection>
      <GenericSection {...props} id="community">
        <div className="center-content">
          <div className="container-sm">
            <h2 className="section-header mt-0 mb-0 reveal-from-top" data-reveal-delay="150">
              Gitcoin Bounties:
            </h2>
            <div className="reveal-from-top" data-reveal-delay="300">
              Why wouldn't you get paid for developing open source software?
              <br />
              Check out our bounties on{' '}
              <a className="underline" href="https://gitcoin.co/hoprnet" target="_blank" rel="noopener noreferrer">
                Gitcoin
              </a>{' '}
              - some are fairly beginner-friendly while some require more in-depth knowledge of the HOPR protocol. HOPR
              is built by the community for the community.
              <br />
              <br />
              (coming mid-July 2020)
            </div>
          </div>
        </div>
      </GenericSection>
    </>
  )
}

OpenSource.propTypes = propTypes
OpenSource.defaultProps = defaultProps

export default OpenSource
