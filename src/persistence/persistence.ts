import { context } from '@actions/github'

import { CommittersDetails, ReactedCommitterMap } from '../interfaces'
import { GitHub } from '@actions/github/lib/utils'
import { getDefaultOctokitClient, getPATOctokit } from '../octokit'

import * as input from '../shared/getInputs'

export async function getFileContent(): Promise<any> {
  const octokitInstance: InstanceType<typeof GitHub> =
    isRemoteRepoOrOrgConfigured() ? getPATOctokit() : getDefaultOctokitClient()

  const result = await octokitInstance.repos.getContent({
    owner: input.getRemoteOrgName() || context.repo.owner,
    repo: input.getRemoteRepoName() || context.repo.repo,
    path: input.getPathToSignatures(),
    ref: input.getBranch()
  })
  return result
}

export async function createFile(contentBinary): Promise<any> {
  const octokitInstance: InstanceType<typeof GitHub> =
    isRemoteRepoOrOrgConfigured() ? getPATOctokit() : getDefaultOctokitClient()

  return octokitInstance.repos.createOrUpdateFileContents({
    owner: input.getRemoteOrgName() || context.repo.owner,
    repo: input.getRemoteRepoName() || context.repo.repo,
    path: input.getPathToSignatures(),
    message:
      input.getCreateFileCommitMessage() ||
      'Creating file for storing CLA Signatures',
    content: contentBinary,
    branch: input.getBranch()
  })
}

export async function updateFile(
  sha: string,
  claFileContent,
  reactedCommitters: ReactedCommitterMap
): Promise<any> {
  const octokitInstance: InstanceType<typeof GitHub> =
    isRemoteRepoOrOrgConfigured() ? getPATOctokit() : getDefaultOctokitClient()

  const pullRequestNo = context.issue.number
  const owner = context.issue.owner
  const repo = context.issue.repo

  claFileContent?.signedContributors.push(...reactedCommitters.newSigned)
  let contentString = JSON.stringify(claFileContent, null, 2)
  let contentBinary = Buffer.from(contentString).toString('base64')
  await octokitInstance.repos.createOrUpdateFileContents({
    owner: input.getRemoteOrgName() || context.repo.owner,
    repo: input.getRemoteRepoName() || context.repo.repo,
    path: input.getPathToSignatures(),
    sha,
    message: buildSignedCommitMessage(
      input.getSignedCommitMessage(),
      reactedCommitters.newSigned,
      context.actor,
      owner,
      repo,
      pullRequestNo
    ),
    content: contentBinary,
    branch: input.getBranch()
  })
}

// actor is whoever posted the triggering comment, which on a "recheck" is not a signer
export function buildSignedCommitMessage(
  template: string,
  signers: CommittersDetails[],
  actor: string,
  owner: string,
  repo: string,
  pullRequestNo: number
): string {
  const names: string = signers.map(signer => `@${signer.name}`).join(', ')
  if (template) {
    return template
      .replace('$contributorName', names)
      .replace('$pullRequestNo', pullRequestNo.toString())
      .replace('$owner', owner)
      .replace('$repo', repo)
  }
  const recheck: string = signers.some(signer => signer.name === actor)
    ? ''
    : ` (recheck by @${actor})`
  return `CLA signed by ${names} in ${owner}/${repo}#${pullRequestNo}${recheck}`
}

function isRemoteRepoOrOrgConfigured(): boolean {
  let isRemoteRepoOrOrgConfigured = false
  if (input?.getRemoteRepoName() || input.getRemoteOrgName()) {
    isRemoteRepoOrOrgConfigured = true
    return isRemoteRepoOrOrgConfigured
  }
  return isRemoteRepoOrOrgConfigured
}
