import {
    activeTeachingPrompt,
    annotationValue,
    applyBeatConstraints,
    beatMeshMemory,
    queryByCommittee,
    selectDjPulse,
    TOP_FIVE_IMPLEMENTATION,
    TOP_FIVE_MEASUREMENT,
    trustedCommunityCorrection,
} from "./active-beat-mesh-v2";
import {
    analysisFoveation,
    beatConsensus,
    classifyGridResidual,
    compatiblePulse,
    confidenceIsland,
    grooveMixStrategy,
    pulseHierarchy,
    transitionMixGrid,
} from "./adaptive-beat-mesh";
import { decideAdaptiveStretch, type StretchDecision } from "./adaptive-stretch";
import { type AffectState, audioOnlyAffect } from "./affect-intelligence";
import { assessAlbumIntegrity, type ContinuityPolicy } from "./album-integrity";
import {
    analyzerRouter,
    artifactAwareLoopScore,
    degradationAwareEnhancement,
    distilledStrategyPrior,
    djSafeRestoration,
    identityDifference,
    personalizedSyncTightness,
    provenanceWeightedAnalysis,
    requiredStemQuality,
} from "./analyzer-transition-knowledge";
import { assessArchitectureStatus, type BeatcordArchitectureStatus } from "./architecture-status";
import {
    aggregateNonSelection,
    analyticsConfidence,
    contextFitAnalytics,
    recommendationSourcePolicy,
} from "./artist-analytics-transparency";
import { artistConsentTier, artistExperimentPlan, multiStakeholderUtility } from "./artist-ecosystem-governance";
import {
    artistDiscoveryQuality,
    artistOpportunity,
    opportunityNormalizedFairness,
} from "./artist-ecosystem-intelligence";
import {
    AUDIO_ARCHITECTURE_V4,
    AUDIO_FIDELITY_SUITE_V4,
    AUDIO_IMPLEMENTATION_PHASES_V4,
    AUDIO_RESEARCH_PRIORITY_V4,
    CODEC_SPATIAL_INDEPENDENCE,
    fidelityBenchResult,
    qualityGuardianV4,
} from "./audio-fidelity-suite-v4";
import {
    BEATCORD_QUALITY_HIERARCHY,
    codecAwareQoe,
    codecRoundTripBenchmark,
    dspNullTest,
    immersiveCollision,
    losslessCacheStrategy,
    masterIntegrityHash,
    minimumDspTier,
    pcmIntegrityTest,
    renderMatrixBenchmark,
    spatialHandoffPolicy,
} from "./audio-integrity-qoe-v1";
import {
    AUDIO_STACK_LAYERS,
    decodeProcessingPipeline,
    FLAC_POLICY,
    sourceResolution,
    validateNativeResolution,
} from "./audio-source-resolution-policy";
import { type BacktimingPlan, planBacktiming, type TimedMomentRequest } from "./backtiming";
import {
    BEAT_MESH_FAILURE_CLASSES_V3,
    BEAT_MESH_VALIDATION_V3,
    beatMeshComplexityRoi,
    beatMeshDeploymentDecision,
    transitionSafetyGain,
} from "./beat-mesh-validation-v3";
import { measurePhaseDrift, syncQualityDecision } from "./beatgrid-intelligence-v2";
import { innovationLane, productIntrusiveness, selectCatalogAccess } from "./business-validation-governance";
import { FULL_PLAYBACK_CAPABILITIES, type PlaybackCapabilities } from "./capability-selection";
import {
    calibrationBenchmark,
    calibrationDrift,
    causalTasteFirewallV2,
    confidenceStack,
    counterfactualTasteMemory,
    microRandomizedRecommendation,
    safeActionSet,
    selfInfluenceAlarm,
    transitionMonteCarlo,
} from "./causal-decision-confidence-v3";
import { causalPreferenceEvidence, causalPreferenceFirewall } from "./causal-taste-firewall";
import {
    CLUB_ENGINE_ARCHITECTURE_V3,
    CLUB_PERFORMANCE_ARC,
    protectMoment,
    transitionQualityGuardian,
} from "./club-performance-validation";
import {
    CLUB_TRANSITION_TAXONOMY,
    planTempoTransition,
    predictPhaseDrift,
    roleCollision,
} from "./club-transition-planner-v2";
import {
    assessCommunityPriorities,
    type CommunityPriorityAssessment,
    finalizeCommunityPriorities,
} from "./community-priorities";
import { harmonicOverlapLimit } from "./confidence-fusion";
import type { TempoStretcherProfile } from "./constants";
import {
    contextChangeDecision,
    discoveryBridge,
    recommendationRecovery,
    resolveContext,
    serendipityValue,
    surpriseBalance,
    truthfulStateLanguage,
} from "./context-serendipity-trust";
import {
    conversationApplication,
    LLM_BOUNDARY,
    RECOMMENDATION_MODE_WEIGHTS,
    usefulExplanation,
} from "./conversational-director";
import {
    type CanonicalRecording,
    canonicalQueue,
    resolvePlaybackSource,
    versionMatch,
} from "./cross-provider-identity";
import { type GroupAggregationPolicy, PHYSIOLOGICAL_SIGNAL_POLICY, selectFairnessPolicy } from "./crowd-experience-v2";
import { PRODUCT_OPTIMIZATION_OBJECTIVE, type SessionContract, validateSessionContract } from "./crowd-intent-contract";
import {
    type ChartRetrievalPrior,
    chartAsWeakPrior,
    type PopularityPerception,
    sessionPlanningPopularity,
} from "./cultural-genre-trends";
import {
    beatSafeResynchronization,
    choosePacketRecovery,
    compilePresentationProgram,
    momentAwareProtection,
    SESSION_FABRIC_V2,
    scheduleMediaObject,
    TRANSPORT_BENCHMARK_SUITE_V2,
    transportRecoveryPolicy,
} from "./deadline-transport-runtime-v2";
import {
    assessUnifiedQuality,
    type DirectorPolicyDecision,
    decideDirectorPolicy,
    type UnifiedQualityGuardianResult,
} from "./director-policy";
import {
    clockSynchronization,
    confidenceSeparation,
    scheduleFutureEvent,
    unifiedRecovery,
} from "./distributed-agent-recovery";
import {
    bitPerfectBypass,
    canonicalContentTimeline,
    finalQuantization,
    gaplessIntegrity,
    immersiveDeliveryCapability,
    internalDspPrecision,
    RESAMPLER_POLICY,
    sampleRateLane,
} from "./dsp-precision-gapless-policy";
import { type EmergencyContinuityPlan, planEmergencyContinuity } from "./emergency-continuity";
import { reliabilitySloStatus, researchConfidence, shadowEvaluation } from "./evaluation-reliability-v2";
import {
    type ConcreteExperienceId,
    detectExperience,
    type ExperienceId,
    type ExperienceSelection,
    interpolateExperiences,
    selectExperience,
} from "./experience-engine";
import {
    DEFAULT_SESSION_PERMISSIONS,
    eventDelivery,
    gameIntegrationPolicy,
    integrationCircuitBreaker,
    lightingIntent,
    ownershipIndicator,
} from "./experience-event-integration";
import {
    experienceScorecard,
    failureBudgetStatus,
    intentExecutionPath,
    qoeGuardian,
} from "./experience-qoe-governance";
import {
    activeTeachingValue,
    calibratedConfidence,
    conformalActionEnvelope,
    correctionPropagation,
    culturalDomainGuard,
    decisionConfidence,
    diffusionStemEscalation,
    type ExplorationLedgerEntry,
    fewShotAdapter,
    microExploration,
} from "./exploration-uncertainty-teaching";
import { mereExposureInterest, perceivedRepetition } from "./exposure-context-intelligence";
import { type FamiliarityState, planFamiliarityBalance, scoreFamiliarityCandidate } from "./familiarity-balance";
import {
    AUDIO_RESEARCH_EXPERIMENTS_V2,
    evidenceUse,
    FORMAT_BACKEND_STRATEGY,
    fidelityAwareUtility,
    matchSceneRoles,
    nativeSpatialTransition,
    OPEN_IMMERSIVE_PROTOTYPE,
    spatialArtisticIntegrity,
    spatialDownmixCritic,
    spatialSceneCollision,
} from "./fidelity-spatial-director-v1";
import { decideCrowdLeadership, familiarityMediatedPleasure, perceivedMusicState } from "./groove-crowd-intelligence";
import { groupRulesForPhase, type PhaseGroupRules } from "./group-recommendation";
import {
    harmonicOwnership,
    hybridReconstruction,
    meterAlignment,
    manipulationCost as perceptualManipulationCost,
    planStemDemand,
    spatialStemGate,
    stemPipeline,
} from "./hierarchical-stem-perceptual-mixing";
import { hybridRecommendationScore } from "./hybrid-recommendation";
import {
    atmosDeliveryValidation,
    binauralQuality,
    codecRoundTripCritic,
    ffmpegRole,
    IMMERSIVE_BACKENDS,
    renderRobustness as immersiveRenderRobustness,
    OPEN_IMMERSIVE_LAB,
    spatialPresentationName,
    spatialSafeMode,
    spatialStemPolicy,
    truePeakGuard,
} from "./immersive-rendering-v1";
import {
    ACCESSIBLE_CONTROL_METHODS,
    crossDeviceSearchScore,
    eventDeliveryPolicy,
    integrationDiscovery,
    SEARCH_ARCHITECTURE,
    sdkSurface,
    visualMotionPolicy,
} from "./integration-sdk-accessibility-search";
import { buildJourneyIntelligence, type JourneyIntelligence } from "./journey-intelligence";
import { type JourneyTemplatePosition, projectJourneyTemplate } from "./journey-templates";
import { harmonicScore } from "./key";
import type { LatencyPlanningAssessment } from "./latency-aware-planning";
import { type Loopability, selectSafeLoop } from "./loopability";
import { selectTransitionRegions, type TransitionRegionSelection } from "./mix-regions";
import { capabilityAwareTransition, type TrackRightsCapabilities } from "./mixed-playlist-rights";
import { B_PRE_ROLL_SEC } from "./mixer";
import {
    availabilityAwareUtility,
    buildSessionMemory,
    DRIVING_MODE,
    hapticEvent,
    karaokeMode,
} from "./mobility-karaoke-memory";
import {
    backtimeTargetMoment,
    computeBudgetForRisk,
    confidenceNativeExplanation,
    momentFirstRecommendation,
} from "./moment-compute-intelligence";
import {
    ADAPTIVE_PRECISION_PIPELINE_V2,
    attentionPreservingQueue,
    compileExperienceProgram,
    contextualSilence,
    embodiedDiscoveryScore,
    experienceResumePoint,
    importancePrecision,
    listeningEffortPolicy,
    multisensoryMomentPlan,
    PERCEPTUAL_OS_QUESTIONS,
    ROUND_II_BUILD,
    ROUND_II_PROTOTYPES,
    ROUND_II_RESEARCH,
    sectionAwareIntent,
    temporalOpportunityCost,
} from "./multisensory-attention-experience";
import {
    compileMusicalIr,
    composedMusicalRisk,
    deadlineTask,
    perceptualMixingCanvas,
} from "./musical-compiler-deadline-risk";
import { analyzeMusicalTension, assessPayoffCut, type PayoffCutAssessment } from "./musical-tension";
import { assessPerceptualMasking, type PerceptualMaskingAssessment } from "./perceptual-masking";
import {
    adaptiveCognitiveLoad,
    distributeSurprise,
    fuseTransitionEvidence,
    genreMixingPolicy,
    loudnessPolicy,
    stemArtifactBudget,
    TRANSITION_PERSONALITIES,
    type TransitionPersonalityPreset,
    ultimateCandidateDecision,
} from "./perceptual-performance-policy";
import {
    adaptiveMasterBudget,
    adaptivePlaybackPolicy,
    ambientLoudnessProtection,
    bioadaptiveEnergy,
    conversationSafeJourney,
    hapticRoleMix,
    motionCompatibility,
    safeEnergyStrategy,
    spatialProfilePolicy,
    spatialRoleHandoff,
} from "./perceptual-playback-embodiment";
import {
    type PerformanceStyleOverride,
    type PerformanceStyleSelection,
    selectPerformanceStyle,
} from "./performance-style";
import { chooseTransitionCue, type TransitionCue } from "./phrase-cues";
import {
    APPLE_REALTIME_TOPOLOGY_V1,
    admitRealtimeModel,
    appleAnalysisRequest,
    creatorPermission,
    deadlineTelemetry,
    fuseMusicalEvidence,
    MUSIC_UNDERSTANDING_BENCH_V1,
} from "./platform-evidence-realtime-v1";
import {
    ACCOUNT_SYNC_SCOPE,
    cloudOutagePlan,
    commandPaletteAction,
    confidenceActionPolicy,
    memoryJourneySeed,
    requestRateLimit,
} from "./platform-search-sync-resilience";
import {
    type ExposureLedgerEntryV2,
    exposureAgencyWeight,
    perceptualDifferenceBudget,
    playbackTwinConfidence,
    playbackTwinExperiment,
    playbackTwinPolicy,
} from "./playback-twin-causal-ledger-v2";
import {
    auracastArchitecture,
    CONTROL_AUDIO_PLANE_ARCHITECTURE,
    compilePresentation,
    contextRequirements,
    LE_AUDIO_BASELINE,
    lc3plusPolicy,
    opusRemotePolicy,
    transportScore,
    wirelessCapability,
} from "./presentation-transport-compiler-v1";
import {
    BEST_INNOVATION_EFFORT_RATIO,
    DEFERRED_FEATURES,
    productPackage,
    transportProfile,
} from "./product-architecture-strategy";
import { buildProgressiveTransitionPlan, type ProgressiveTransitionPlan } from "./progressive-planning";
import { evaluationEnsemble, provenanceRecommendation, signalPath } from "./provenance-signal-integrity";
import {
    assertProviderAction,
    EXPERIENCE_DNA_PRESETS,
    morphExperienceDna,
    providerCapabilities,
    validateInnovation,
} from "./provider-innovation-validation";
import { buildMaskingMatrix, psychoacousticGuardian } from "./psychoacoustic-transition-critic";
import {
    environmentAdaptation,
    evaluateQualityGuardianV3,
    monoFoldDownSafety,
    QUALITY_GUARDIAN_V3_BOUNDARY,
} from "./quality-guardian-v3";
import {
    adaptiveBufferHorizon,
    aiResponseRoute,
    dspDegradation,
    qoeAwareRouteScore,
    qualityOfExperienceScore,
    streamingDegradation,
    transitionReadiness,
} from "./quality-of-experience";
import { assessAudioRoute, chooseDspQuality, REALTIME_ARCHITECTURE } from "./realtime-audio-reliability";
import {
    capabilityMatrix,
    DSP_PREWARM,
    negotiateRoute,
    ROUTE_CHANGE_STATES_V2,
    rendererChange,
    routeDspBackend,
    sectionAdaptiveStretch,
    stretchQualityTier,
} from "./realtime-dsp-route-v3";
import {
    type RankedRecommendation,
    type RecommendationObjectives,
    rankRecommendations as rankRecommendationSet,
    recommendationWeights,
} from "./recommendation-intelligence";
import {
    evaluateRecommendationHardGates,
    RECOMMENDATION_ARCHITECTURE_V2,
    type RecommendationV2Audit,
    recommendationScoreV2,
} from "./recommendation-routing-v2";
import {
    type AdvancedExperienceDimensions,
    advancedDimensionsForSelection,
    buildWhyThis,
    enforceIntelligenceBoundary,
    governLearningSignal,
    type IntelligenceBoundaryDecision,
    type LearningSessionMode,
    type WhyThisExplanation,
} from "./research-experience-policy";
import { SECOND_DEPTH_RESEARCH, type SecondDepthResearchLandscape } from "./research-landscape";
import { assessResearchPrinciples, type ResearchPrincipleCompliance } from "./research-principles";
import { type ResearchDecisionProvenance, researchProvenanceForDecision } from "./research-registry";
import { type DiscoveryBudgetPlan, planDiscoveryBudget } from "./responsible-recommendation";
import {
    analysisFunnel,
    cheapMixabilityPredictor,
    counterfactualMixSearch,
    mixDifficulty,
    transitionAwareRecommendationScore,
    transitionRobustness,
} from "./robust-transition-funnel";
import {
    cloneRuntimeEvidenceSummary,
    emptyRuntimeEvidenceSummary,
    type RuntimeEvidenceSummaryV1,
} from "./runtime-evidence-ledger-v1";
import {
    accessiblePresentation,
    energyStrategy,
    hearingAccessibility,
    safeLoudnessGuard,
} from "./safe-listening-accessibility";
import {
    applySemanticControl,
    semanticHardwareBoundary,
    semanticListeningBus,
    semanticListeningLevel,
    semanticMomentProtection,
    semanticResponse,
    spectralConversationPocket,
} from "./semantic-listening-v1";
import {
    contextualFit,
    culturalGeneralization,
    discoveryBudget as semanticDiscoveryBudget,
    semanticJourney,
} from "./semantic-music-intelligence";
import {
    capabilityAwareHandoff,
    intelligentHandoffTiming,
    surfaceControls,
    validateHandoffState,
} from "./session-continuity-platform";
import {
    assessSessionFatigue,
    type FatigueState,
    type TransitionNoveltyBudget,
    transitionNoveltyBudget,
} from "./session-fatigue";
import { planSessionJourney, type SessionJourneyPlan, scoreJourneyAlignment } from "./session-journey";
import {
    progressiveControls,
    routeGuestRequest,
    SOCIAL_EXPERIENCE,
    socialRecommendationValue,
    ZERO_CONFIGURATION_EXPERIENCE,
} from "./social-privacy-journey-ux";
import { ambientMusicPresence, sessionPermissions, socialContextPolicy } from "./social-session-governance";
import {
    computeMigration,
    computePlacement,
    decisionProvenanceGraph,
    perceptualStemBakeOff,
    recommendationSelfInfluence,
    reconstructionResidual,
    routeStemJob,
    shadowDirector,
    spatialIntegrityGate,
    TINY_LOCAL_SPECIALISTS,
    VERSION_ALIGNMENT_PIPELINE,
    versionAssistedStem,
} from "./stem-compute-provenance-v2";
import {
    constructSequentialTransition,
    rolePreset,
    stemQualityScore,
    transitionLocalRestoration,
} from "./stem-restoration-sequential";
import { assessStrategyFatigue, type StrategyFatigue } from "./strategy-fatigue";
import { assessSurpriseBudget, classifySurprise, type SurpriseBudget } from "./surprise-budget";
import {
    dataPolicy,
    LOCAL_FIRST_DATA_BOUNDARY,
    reliabilityPriority,
    tasteLearningPolicy,
} from "./taste-privacy-governance";
import { fuseMusicEvidence, reflectiveRetry, temporalIntentGraph } from "./temporal-agent-orchestration";
import {
    HUMAN_AI_CONTROL_MODES,
    RESEARCH_BACKED_ARCHITECTURE,
    type RecommendationUncertainty,
    riskSensitiveScore,
} from "./temporal-recommendation-research";
import {
    assessTrackCompatibility,
    type CompatibilityTarget,
    scoreCompatibilityRoutes,
    type TrackCompatibility,
    type TrackCompatibilityRoute,
} from "./track-compatibility";
import { versionPreferenceAdjustment } from "./track-identity";
import type { TrackProfile } from "./track-profile";
import {
    AC4_RESEARCH_POLICY,
    AUDIO_ROUTE_TEST_MATRIX_V2,
    artifactRepair,
    dependencyCapability,
    fidelityStatus,
    metadataPreservationTest,
    type PortableSpatialTransitionV1,
    postRendererTransitionCritic,
    renderSpecificAutomation,
    resamplingGraph,
    sourceFidelityLedger,
    stretchRoute,
} from "./transform-fidelity-ledger-v2";
import {
    buildTransitionCandidates,
    type TransitionFeedbackProfile,
    type TransitionSignalScores,
} from "./transition-candidates";
import { criticDisagreement, evaluateTransitionCriticV2 } from "./transition-critic-v2";
import {
    arrangementCompetition,
    harmonicTransitionStrategy,
    materialTransitionPolicy,
    TRANSITION_NOTICEABILITY_TARGETS,
    type TransitionExperience,
} from "./transition-material-intelligence";
import {
    allowedOverrideRegions,
    overrideMatches,
    type TransitionOverride,
    type TransitionOverrideAudit,
} from "./transition-override";
import type { TrackTraits, TransitionPlan, TransitionType } from "./transition-planner";
import {
    mixPointPrior,
    preferenceGraph,
    TRANSITION_LAB_V4,
    transitionCriticV4,
    transitionLabShipGate,
} from "./transition-validation-lab-v4";
import { buildUltimateVisionDecision, type UltimateVisionDecision } from "./ultimate-vision";
import {
    compileSessionLanguage,
    crowdCoDirector,
    localTransitionRepair,
    momentLevelCandidate,
    noActionPolicy,
    roleBasedMixing,
    rollingHorizon,
    semanticEcosystemEvent,
    transitionCriticStage,
} from "./validated-experience-innovations";
import { compileValidationRuntimeV1, type ValidationRuntimeV1 } from "./validation-runtime-compiler-v1";

export type SessionPhase = "warmup" | "build" | "momentum" | "peak" | "reset" | "rebuild" | "finale" | "cooldown";

export interface SessionContext {
    mood: ExperienceId;
    moodIntensity: number;
    currentEnergy: number;
    targetEnergy: number;
    sessionAgeMinutes: number;
    recentGenres: string[];
    recentKeys: string[];
    recentBpms: number[];
    peakReached: boolean;
    userSkips: number;
    userLikes: number;
    phase: SessionPhase;
}

export interface TransitionHistoryEntry {
    atMs: number;
    fromTrackId: string;
    toTrackId: string;
    type: TransitionType;
    confidence: number;
    outcome?: "played" | "skipped";
}

export interface MusicalMemory {
    lastEnergyPeakAt?: number;
    lastMajorDropAt?: number;
    lastBreatherAt?: number;
    recentArtists: string[];
    recentGenres: string[];
    recentKeys: string[];
    recentBpms: number[];
    vocalDensityHistory: number[];
    energyHistory: number[];
    transitionHistory: TransitionHistoryEntry[];
}

export interface ManipulationBudget {
    total: number;
    timeStretch: number;
    pitchShift: number;
    looping: number;
    stemMixing: number;
    structureEditing: number;
    effects: number;
}

export type TransitionIntentStyle =
    | "natural"
    | "cut"
    | "fade"
    | "blend"
    | "beatmatch"
    | "bass-swap"
    | "filter"
    | "echo"
    | "drop"
    | "loop"
    | "stem-mix";

export interface TransitionIntent {
    style: TransitionIntentStyle;
    intensity: number;
    durationBeats?: number;
    preserveTempo: boolean;
    preserveVocals: boolean;
    preserveStructure: boolean;
    targetEnergyDelta: number;
    confidence: number;
}

export interface TransitionReasoning {
    selected: string;
    reasons: string[];
    rejected: { type: string; reason: string }[];
    safetyFallback: boolean;
}

export interface DirectorTransitionOptions {
    fadeSec: number;
    tempoSync: boolean;
    eqSweep: boolean;
    harmonic: boolean;
    stemsReady: boolean;
    outgoingTempoRatio: number;
    feedback?: TransitionFeedbackProfile | null;
    maxFadeSec?: number;
    lookaheadProfiles?: readonly TrackProfile[];
    stretcherProfile?: TempoStretcherProfile;
    highQualityStretch?: boolean;
    currentPositionSec?: number;
    performanceStyle?: PerformanceStyleOverride | null;
}

export interface DirectedTransition {
    plan: TransitionPlan;
    cue: TransitionCue;
    preRollSec: number;
    intent: TransitionIntent;
    experience: ExperienceSelection;
    session: SessionContext;
    journey: SessionJourneyPlan;
    communityPriorities: CommunityPriorityAssessment;
    architecture: BeatcordArchitectureStatus;
    research: ResearchDecisionProvenance;
    principles: ResearchPrincipleCompliance;
    researchLandscape: SecondDepthResearchLandscape;
    performanceStyle: PerformanceStyleSelection;
    progressivePlan: ProgressiveTransitionPlan;
    musicalIntelligence: JourneyIntelligence;
    vision: UltimateVisionDecision;
    journeyTemplate: JourneyTemplatePosition;
    familiarity: FamiliarityState;
    surpriseBudget: SurpriseBudget;
    strategyFatigue: StrategyFatigue;
    tension: { sections: ReturnType<typeof analyzeMusicalTension>; cut: PayoffCutAssessment };
    loopability: Loopability | null;
    emergencyContinuity: EmergencyContinuityPlan;
    backtiming: BacktimingPlan | null;
    continuityPolicy: ContinuityPolicy;
    policyDecision: DirectorPolicyDecision;
    unifiedQuality: UnifiedQualityGuardianResult;
    advancedExperience: AdvancedExperienceDimensions;
    whyThis: WhyThisExplanation;
    intelligenceBoundary: IntelligenceBoundaryDecision[];
    learningSessionMode: LearningSessionMode;
    groupRules: PhaseGroupRules;
    recommendationV2: RecommendationV2Audit;
    affect: AffectState;
    crowdGovernance: DirectorCrowdGovernance;
    recommendationGovernance: DirectorRecommendationGovernance;
    researchGovernance: DirectorResearchGovernance;
    materialIntelligence: DirectorMaterialIntelligence;
    grooveCrowdIntelligence: DirectorGrooveCrowdIntelligence;
    exposureContext: DirectorExposureContext;
    performancePolicy: DirectorPerformancePolicy;
    beatgridV2: DirectorBeatgridV2;
    clubV3: DirectorClubV3;
    realtimeReliability: DirectorRealtimeReliability;
    psychoacousticCritic: DirectorPsychoacousticCritic;
    transitionCriticV2: DirectorTransitionCriticV2;
    conversationPolicy: DirectorConversationPolicy;
    tastePrivacy: DirectorTastePrivacy;
    qualityGuardianV3: DirectorQualityGuardianV3;
    evaluationReliabilityV2: DirectorEvaluationReliabilityV2;
    semanticIntelligence: DirectorSemanticIntelligence;
    safeListening: DirectorSafeListening;
    distributedRecovery: DirectorDistributedRecovery;
    rightsPlanning: DirectorRightsPlanning;
    temporalAgent: DirectorTemporalAgent;
    stemSequential: DirectorStemSequential;
    provenanceSignal: DirectorProvenanceSignal;
    momentCompute: DirectorMomentCompute;
    artistEcosystem: DirectorArtistEcosystem;
    artistAnalytics: DirectorArtistAnalytics;
    artistGovernance: DirectorArtistGovernance;
    sessionContinuity: DirectorSessionContinuity;
    crossProviderIdentity: DirectorCrossProviderIdentity;
    socialSession: DirectorSocialSession;
    experienceIntegration: DirectorExperienceIntegration;
    mobilityKaraokeMemory: DirectorMobilityKaraokeMemory;
    socialPrivacyUx: DirectorSocialPrivacyUx;
    integrationSdkAccessibility: DirectorIntegrationSdkAccessibility;
    platformResilience: DirectorPlatformResilience;
    contextSerendipityTrust: DirectorContextSerendipityTrust;
    qualityOfExperience: DirectorQualityOfExperience;
    experienceQoeGovernance: DirectorExperienceQoeGovernance;
    providerInnovation: DirectorProviderInnovation;
    validatedInnovations: DirectorValidatedInnovations;
    productStrategy: DirectorProductStrategy;
    businessValidation: DirectorBusinessValidation;
    adaptiveBeatMesh: DirectorAdaptiveBeatMesh;
    hierarchicalStemMixing: DirectorHierarchicalStemMixing;
    robustTransitionFunnel: DirectorRobustTransitionFunnel;
    analyzerKnowledge: DirectorAnalyzerKnowledge;
    musicalCompiler: DirectorMusicalCompiler;
    perceptualPlayback: DirectorPerceptualPlayback;
    causalTaste: DirectorCausalTaste;
    explorationUncertaintyTeaching: DirectorExplorationUncertaintyTeaching;
    stemComputeProvenanceV2: DirectorStemComputeProvenanceV2;
    multisensoryAttentionExperience: DirectorMultisensoryAttentionExperience;
    playbackTwinCausalLedgerV2: DirectorPlaybackTwinCausalLedgerV2;
    causalDecisionConfidenceV3: DirectorCausalDecisionConfidenceV3;
    semanticListeningV1: DirectorSemanticListeningV1;
    activeBeatMeshV2: DirectorActiveBeatMeshV2;
    audioSourceResolutionPolicy: DirectorAudioSourceResolutionPolicy;
    dspPrecisionGaplessPolicy: DirectorDspPrecisionGaplessPolicy;
    immersiveRenderingV1: DirectorImmersiveRenderingV1;
    realtimeDspRouteV3: DirectorRealtimeDspRouteV3;
    audioIntegrityQoeV1: DirectorAudioIntegrityQoeV1;
    transformFidelityLedgerV2: DirectorTransformFidelityLedgerV2;
    fidelitySpatialV1: DirectorFidelitySpatialV1;
    audioFidelitySuiteV4: DirectorAudioFidelitySuiteV4;
    presentationTransportV1: DirectorPresentationTransportV1;
    deadlineTransportV2: DirectorDeadlineTransportV2;
    platformEvidenceRealtimeV1: DirectorPlatformEvidenceRealtimeV1;
    transitionValidationLabV4: DirectorTransitionValidationLabV4;
    beatMeshValidationV3: DirectorBeatMeshValidationV3;
    beatMeshTortureLabV1: DirectorBeatMeshTortureLabV1;
    stemTransitionUtilityV1: DirectorStemTransitionUtilityV1;
    longitudinalTasteLabV1: DirectorLongitudinalTasteLabV1;
    humanInterventionLabV1: DirectorHumanInterventionLabV1;
    runtimeEvidence: RuntimeEvidenceSummaryV1;
    manipulationBudget: ManipulationBudget;
    reasoning: TransitionReasoning;
    perceptualMasking: PerceptualMaskingAssessment;
    stretchDecision: StretchDecision;
    regionSelection: TransitionRegionSelection | null;
    compatibility: TrackCompatibility;
    compatibilityRoute: TrackCompatibilityRoute;
    fatigue: FatigueState;
    noveltyBudget: TransitionNoveltyBudget;
    override: TransitionOverrideAudit | null;
    decision: DirectorDecisionLog;
}

export interface DirectorCrowdGovernance {
    fairnessPolicy: GroupAggregationPolicy;
    moodGroundTruth: false;
    physiologicalSignalsRequired: false;
    physiologicalSignalsDefaultEnabled: false;
}

export interface DirectorRecommendationGovernance {
    discoveryBudget: DiscoveryBudgetPlan;
    sessionContract: ReturnType<typeof validateSessionContract>;
    primaryObjective: typeof PRODUCT_OPTIMIZATION_OBJECTIVE.primary;
    engagementRole: typeof PRODUCT_OPTIMIZATION_OBJECTIVE.engagementRole;
    chartPrior: ChartRetrievalPrior;
    familiarityPlanning: ReturnType<typeof sessionPlanningPopularity>;
}

export interface DirectorResearchGovernance {
    uncertainty: RecommendationUncertainty;
    riskAdjustedUtility: number;
    controlMode: "director";
    controlModeLabel: string;
    architecture: typeof RESEARCH_BACKED_ARCHITECTURE;
}

export interface DirectorMaterialIntelligence {
    materialPolicy: ReturnType<typeof materialTransitionPolicy>;
    noticeabilityTarget: (typeof TRANSITION_NOTICEABILITY_TARGETS)[TransitionExperience];
    arrangementCompetition: ReturnType<typeof arrangementCompetition>;
    harmonicStrategy: ReturnType<typeof harmonicTransitionStrategy>;
}

export interface DirectorGrooveCrowdIntelligence {
    perceptualState: ReturnType<typeof perceivedMusicState>;
    crowdLeadership: ReturnType<typeof decideCrowdLeadership>;
    familiarityPleasure: ReturnType<typeof familiarityMediatedPleasure>;
}

export interface DirectorExposureContext {
    exposure: ReturnType<typeof mereExposureInterest>;
    perceivedRepetition: number;
    contextSpecific: true;
}

export interface DirectorPerformancePolicy {
    loudness: ReturnType<typeof loudnessPolicy>;
    personalityPreset: TransitionPersonalityPreset;
    personality: (typeof TRANSITION_PERSONALITIES)[TransitionPersonalityPreset];
    genrePolicy: ReturnType<typeof genreMixingPolicy>;
    stemArtifacts: ReturnType<typeof stemArtifactBudget>;
    evidence: ReturnType<typeof fuseTransitionEvidence>;
    surprise: ReturnType<typeof distributeSurprise>;
    cognitiveLoad: ReturnType<typeof adaptiveCognitiveLoad>;
    candidateDecision: ReturnType<typeof ultimateCandidateDecision>;
}

export interface DirectorBeatgridV2 {
    sync: ReturnType<typeof syncQualityDecision>;
    phase: ReturnType<typeof measurePhaseDrift>;
    phraseLocked: boolean;
}

export interface DirectorClubV3 {
    architecture: typeof CLUB_ENGINE_ARCHITECTURE_V3;
    performance: (typeof CLUB_PERFORMANCE_ARC)[keyof typeof CLUB_PERFORMANCE_ARC];
    tempoPlan: ReturnType<typeof planTempoTransition>;
    driftCorrection: ReturnType<typeof predictPhaseDrift>;
    vocalCollision: ReturnType<typeof roleCollision>;
    leadCollision: ReturnType<typeof roleCollision>;
    lowEndCollision: ReturnType<typeof roleCollision>;
    momentProtection: ReturnType<typeof protectMoment>;
    qualityGuardian: ReturnType<typeof transitionQualityGuardian>;
    taxonomyFamilies: number;
}

export interface DirectorRealtimeReliability {
    architecture: typeof REALTIME_ARCHITECTURE;
    route: ReturnType<typeof assessAudioRoute>;
    qos: ReturnType<typeof chooseDspQuality>;
}

export interface DirectorPsychoacousticCritic {
    guardian: ReturnType<typeof psychoacousticGuardian>;
    rolePairs: number;
}

export interface DirectorTransitionCriticV2 {
    evaluation: ReturnType<typeof evaluateTransitionCriticV2>;
    disagreement: ReturnType<typeof criticDisagreement>;
}

export interface DirectorConversationPolicy {
    boundary: typeof LLM_BOUNDARY;
    application: ReturnType<typeof conversationApplication>;
    recommendationMode: (typeof RECOMMENDATION_MODE_WEIGHTS)["best-mix"];
    explanation: ReturnType<typeof usefulExplanation>;
}

export interface DirectorTastePrivacy {
    learning: ReturnType<typeof tasteLearningPolicy>;
    data: ReturnType<typeof dataPolicy>;
    localFirstBoundary: typeof LOCAL_FIRST_DATA_BOUNDARY;
    reliabilityPriority: ReturnType<typeof reliabilityPriority>;
}

export interface DirectorQualityGuardianV3 {
    guardian: ReturnType<typeof evaluateQualityGuardianV3>;
    environment: ReturnType<typeof environmentAdaptation>;
    monoSafety: ReturnType<typeof monoFoldDownSafety>;
    boundary: typeof QUALITY_GUARDIAN_V3_BOUNDARY;
}

export interface DirectorEvaluationReliabilityV2 {
    slos: ReturnType<typeof reliabilitySloStatus>;
    naturalnessResearch: ReturnType<typeof researchConfidence>;
    shadowCritic: ReturnType<typeof shadowEvaluation<string>>;
}

export interface DirectorSemanticIntelligence {
    fit: ReturnType<typeof contextualFit>;
    culturalConfidence: ReturnType<typeof culturalGeneralization>;
    discovery: ReturnType<typeof semanticDiscoveryBudget>;
    journey: ReturnType<typeof semanticJourney>;
}

export interface DirectorSafeListening {
    hearing: ReturnType<typeof hearingAccessibility>;
    loudness: ReturnType<typeof safeLoudnessGuard>;
    energy: ReturnType<typeof energyStrategy>;
    presentation: ReturnType<typeof accessiblePresentation>;
}

export interface DirectorDistributedRecovery {
    futureEvent: ReturnType<typeof scheduleFutureEvent>;
    clock: ReturnType<typeof clockSynchronization>;
    confidence: ReturnType<typeof confidenceSeparation>;
    recovery: ReturnType<typeof unifiedRecovery>;
}

export interface DirectorRightsPlanning {
    capabilities: TrackRightsCapabilities;
    transition: ReturnType<typeof capabilityAwareTransition>;
}

export interface DirectorTemporalAgent {
    graph: ReturnType<typeof temporalIntentGraph>;
    retry: ReturnType<typeof reflectiveRetry>;
    evidence: ReturnType<typeof fuseMusicEvidence<number>>;
}

export interface DirectorStemSequential {
    quality: number;
    restoration: ReturnType<typeof transitionLocalRestoration>;
    construction: ReturnType<typeof constructSequentialTransition>;
}

export interface DirectorProvenanceSignal {
    provenance: ReturnType<typeof provenanceRecommendation>;
    signalPath: ReturnType<typeof signalPath>;
    evaluation: ReturnType<typeof evaluationEnsemble>;
}

export interface DirectorMomentCompute {
    recommendation: ReturnType<typeof momentFirstRecommendation>;
    target: ReturnType<typeof backtimeTargetMoment>;
    compute: ReturnType<typeof computeBudgetForRisk>;
    explanation: ReturnType<typeof confidenceNativeExplanation>;
}

export interface DirectorArtistEcosystem {
    relationshipOpportunity: ReturnType<typeof artistOpportunity>;
    discoveryQuality: ReturnType<typeof artistDiscoveryQuality>;
    exposureFairness: ReturnType<typeof opportunityNormalizedFairness>;
}

export interface DirectorArtistAnalytics {
    nonSelection: ReturnType<typeof aggregateNonSelection>;
    contextFit: ReturnType<typeof contextFitAnalytics>;
    confidence: ReturnType<typeof analyticsConfidence>;
    sourcePolicy: ReturnType<typeof recommendationSourcePolicy>;
}

export interface DirectorArtistGovernance {
    utility: ReturnType<typeof multiStakeholderUtility>;
    consent: ReturnType<typeof artistConsentTier>;
    experiment: ReturnType<typeof artistExperimentPlan>;
}

export interface DirectorSessionContinuity {
    handoffState: ReturnType<typeof validateHandoffState>;
    timing: ReturnType<typeof intelligentHandoffTiming>;
    capability: ReturnType<typeof capabilityAwareHandoff>;
    controls: ReturnType<typeof surfaceControls>;
}

export interface DirectorCrossProviderIdentity {
    queue: ReturnType<typeof canonicalQueue>;
    version: ReturnType<typeof versionMatch>;
    source: ReturnType<typeof resolvePlaybackSource>;
}

export interface DirectorSocialSession {
    context: ReturnType<typeof socialContextPolicy>;
    hostPermissions: ReturnType<typeof sessionPermissions>;
    presence: ReturnType<typeof ambientMusicPresence>;
}

export interface DirectorExperienceIntegration {
    permissions: typeof DEFAULT_SESSION_PERMISSIONS;
    ownership: ReturnType<typeof ownershipIndicator>;
    event: ReturnType<typeof eventDelivery>;
    circuitBreaker: ReturnType<typeof integrationCircuitBreaker>;
    lighting: ReturnType<typeof lightingIntent>;
    gameContext: ReturnType<typeof gameIntegrationPolicy>;
}

export interface DirectorMobilityKaraokeMemory {
    driving: typeof DRIVING_MODE;
    offlineUtility: number;
    haptic: ReturnType<typeof hapticEvent>;
    karaoke: ReturnType<typeof karaokeMode>;
    memory: ReturnType<typeof buildSessionMemory>;
}

export interface DirectorSocialPrivacyUx {
    controls: string[];
    zeroConfiguration: typeof ZERO_CONFIGURATION_EXPERIENCE;
    guestRequest: ReturnType<typeof routeGuestRequest>;
    recommendationValue: number;
    social: typeof SOCIAL_EXPERIENCE;
}

export interface DirectorIntegrationSdkAccessibility {
    discovery: ReturnType<typeof integrationDiscovery>;
    observationApi: ReturnType<typeof sdkSurface>;
    realtimeDelivery: ReturnType<typeof eventDeliveryPolicy>;
    accessibleControls: typeof ACCESSIBLE_CONTROL_METHODS;
    motion: ReturnType<typeof visualMotionPolicy>;
    searchScore: number;
    searchArchitecture: typeof SEARCH_ARCHITECTURE;
}

export interface DirectorPlatformResilience {
    accountSync: typeof ACCOUNT_SYNC_SCOPE;
    command: ReturnType<typeof commandPaletteAction>;
    outage: ReturnType<typeof cloudOutagePlan>;
    requests: ReturnType<typeof requestRateLimit>;
    memorySeed: ReturnType<typeof memoryJourneySeed>;
    confidenceBehavior: ReturnType<typeof confidenceActionPolicy>;
}

export interface DirectorContextSerendipityTrust {
    context: ReturnType<typeof resolveContext<string>>;
    contextChange: ReturnType<typeof contextChangeDecision>;
    serendipity: number;
    surpriseBalance: ReturnType<typeof surpriseBalance>;
    discoveryBridge: ReturnType<typeof discoveryBridge>;
    recovery: ReturnType<typeof recommendationRecovery>;
    truthfulState: string;
}

export interface DirectorQualityOfExperience {
    score: number;
    buffer: ReturnType<typeof adaptiveBufferHorizon>;
    readiness: ReturnType<typeof transitionReadiness>;
    routeScore: number;
    streaming: ReturnType<typeof streamingDegradation>;
    dsp: ReturnType<typeof dspDegradation>;
    aiResponse: ReturnType<typeof aiResponseRoute>;
}

export interface DirectorExperienceQoeGovernance {
    intent: ReturnType<typeof intentExecutionPath>;
    guardian: ReturnType<typeof qoeGuardian>;
    failureBudget: ReturnType<typeof failureBudgetStatus>;
    scorecard: ReturnType<typeof experienceScorecard>;
}

export interface DirectorProviderInnovation {
    capabilities: ReturnType<typeof providerCapabilities>;
    mixing: ReturnType<typeof assertProviderAction>;
    validation: ReturnType<typeof validateInnovation>;
    experienceDna: ReturnType<typeof morphExperienceDna>;
}

export interface DirectorValidatedInnovations {
    moment: ReturnType<typeof momentLevelCandidate>;
    route: ReturnType<typeof rollingHorizon>;
    roleMixing: ReturnType<typeof roleBasedMixing>;
    critic: ReturnType<typeof transitionCriticStage>;
    repair: ReturnType<typeof localTransitionRepair>;
    crowd: ReturnType<typeof crowdCoDirector>;
    copilot: ReturnType<typeof compileSessionLanguage>;
    ecosystemEvent: ReturnType<typeof semanticEcosystemEvent>;
    directorAction: ReturnType<typeof noActionPolicy>;
}

export interface DirectorProductStrategy {
    transport: ReturnType<typeof transportProfile>;
    package: ReturnType<typeof productPackage>;
    bestEffortRatio: typeof BEST_INNOVATION_EFFORT_RATIO;
    deferred: typeof DEFERRED_FEATURES;
}

export interface DirectorBusinessValidation {
    catalogAccess: ReturnType<typeof selectCatalogAccess>;
    lane: ReturnType<typeof innovationLane>;
    intrusiveness: ReturnType<typeof productIntrusiveness>;
}

export interface DirectorAdaptiveBeatMesh {
    outgoingPulse: ReturnType<typeof pulseHierarchy>;
    incomingPulse: ReturnType<typeof pulseHierarchy>;
    compatibility: ReturnType<typeof compatiblePulse>;
    consensus: ReturnType<typeof beatConsensus>;
    confidenceIsland: ReturnType<typeof confidenceIsland>;
    mixGrid: ReturnType<typeof transitionMixGrid>;
    compute: ReturnType<typeof analysisFoveation>;
    state: ReturnType<typeof classifyGridResidual>;
    grooveStrategy: ReturnType<typeof grooveMixStrategy>;
}

export interface DirectorHierarchicalStemMixing {
    demand: ReturnType<typeof planStemDemand>;
    pipeline: ReturnType<typeof stemPipeline>;
    reconstruction: ReturnType<typeof hybridReconstruction>;
    spatialGate: ReturnType<typeof spatialStemGate>;
    meter: ReturnType<typeof meterAlignment>;
    harmony: ReturnType<typeof harmonicOwnership>;
    manipulationCost: number;
}

export interface DirectorRobustTransitionFunnel {
    counterfactual: ReturnType<typeof counterfactualMixSearch>;
    robustness: ReturnType<typeof transitionRobustness>;
    difficulty: ReturnType<typeof mixDifficulty>;
    cheapMixability: number;
    recommendationScore: number;
    funnel: ReturnType<typeof analysisFunnel>;
}

export interface DirectorAnalyzerKnowledge {
    analyzer: ReturnType<typeof analyzerRouter>;
    provenance: ReturnType<typeof provenanceWeightedAnalysis<number>>;
    syncTightness: number;
    requiredStemQuality: number;
    loopScore: number;
    strategyPrior: ReturnType<typeof distilledStrategyPrior>;
    enhancement: ReturnType<typeof degradationAwareEnhancement>;
    restoration: ReturnType<typeof djSafeRestoration>;
}

export interface DirectorMusicalCompiler {
    deadline: ReturnType<typeof deadlineTask>;
    risk: ReturnType<typeof composedMusicalRisk>;
    canvas: ReturnType<typeof perceptualMixingCanvas>;
    compilation: ReturnType<typeof compileMusicalIr>;
}

export interface DirectorPerceptualPlayback {
    playbackPolicy: ReturnType<typeof adaptivePlaybackPolicy>;
    masterBudget: ReturnType<typeof adaptiveMasterBudget>;
    ambientProtection: ReturnType<typeof ambientLoudnessProtection>;
    safeEnergy: ReturnType<typeof safeEnergyStrategy>;
    conversation: ReturnType<typeof conversationSafeJourney>;
    spatialProfile: ReturnType<typeof spatialProfilePolicy>;
    spatialHandoff: ReturnType<typeof spatialRoleHandoff>;
    haptics: ReturnType<typeof hapticRoleMix>;
    motionCompatibility: number;
    bioadaptive: ReturnType<typeof bioadaptiveEnergy>;
}

export interface DirectorCausalTaste {
    evidence: ReturnType<typeof causalPreferenceEvidence>;
    firewall: ReturnType<typeof causalPreferenceFirewall>;
}

export interface DirectorExplorationUncertaintyTeaching {
    ledger: ExplorationLedgerEntry;
    exploration: ReturnType<typeof microExploration>;
    calibration: ReturnType<typeof calibratedConfidence>;
    decisionConfidence: number;
    envelope: ReturnType<typeof conformalActionEnvelope>;
    teaching: ReturnType<typeof activeTeachingValue>;
    correctionDependencies: string[];
    adapter: ReturnType<typeof fewShotAdapter>;
    domainGuard: ReturnType<typeof culturalDomainGuard>;
    diffusion: ReturnType<typeof diffusionStemEscalation>;
}

export interface DirectorStemComputeProvenanceV2 {
    alignmentPipeline: typeof VERSION_ALIGNMENT_PIPELINE;
    versionPrior: ReturnType<typeof versionAssistedStem>;
    residual: ReturnType<typeof reconstructionResidual>;
    spatialIntegrity: ReturnType<typeof spatialIntegrityGate>;
    bakeOff: ReturnType<typeof perceptualStemBakeOff>;
    model: ReturnType<typeof routeStemJob>;
    localSpecialists: typeof TINY_LOCAL_SPECIALISTS;
    placement: ReturnType<typeof computePlacement>;
    migration: ReturnType<typeof computeMigration>;
    provenance: ReturnType<typeof decisionProvenanceGraph>;
    shadow: ReturnType<typeof shadowDirector>;
    selfInfluence: ReturnType<typeof recommendationSelfInfluence>;
}

export interface DirectorMultisensoryAttentionExperience {
    movementBridge: number;
    moment: ReturnType<typeof multisensoryMomentPlan>;
    precision: ReturnType<typeof importancePrecision>;
    attention: ReturnType<typeof attentionPreservingQueue>;
    resume: ReturnType<typeof experienceResumePoint>;
    listeningEffort: ReturnType<typeof listeningEffortPolicy>;
    silence: ReturnType<typeof contextualSilence>;
    sectionIntent: ReturnType<typeof sectionAwareIntent>;
    opportunityCost: ReturnType<typeof temporalOpportunityCost>;
    precisionPipeline: typeof ADAPTIVE_PRECISION_PIPELINE_V2;
    program: ReturnType<typeof compileExperienceProgram>;
    priorities: {
        build: typeof ROUND_II_BUILD;
        prototypes: typeof ROUND_II_PROTOTYPES;
        research: typeof ROUND_II_RESEARCH;
        perceptualOsQuestions: typeof PERCEPTUAL_OS_QUESTIONS;
    };
}

export interface DirectorPlaybackTwinCausalLedgerV2 {
    confidence: number;
    differenceBudget: ReturnType<typeof perceptualDifferenceBudget>;
    policy: ReturnType<typeof playbackTwinPolicy>;
    experiment: ReturnType<typeof playbackTwinExperiment>;
    exposure: ExposureLedgerEntryV2;
    agency: ReturnType<typeof exposureAgencyWeight>;
}

export interface DirectorCausalDecisionConfidenceV3 {
    taste: ReturnType<typeof counterfactualTasteMemory>;
    exploration: ReturnType<typeof microRandomizedRecommendation>;
    firewall: ReturnType<typeof causalTasteFirewallV2>;
    alarm: ReturnType<typeof selfInfluenceAlarm>;
    confidence: ReturnType<typeof confidenceStack>;
    monteCarlo: ReturnType<typeof transitionMonteCarlo>;
    actions: ReturnType<typeof safeActionSet>;
    benchmark: ReturnType<typeof calibrationBenchmark>;
    drift: ReturnType<typeof calibrationDrift>;
}

export interface DirectorSemanticListeningV1 {
    level: ReturnType<typeof semanticListeningLevel>;
    bus: ReturnType<typeof semanticListeningBus>;
    response: ReturnType<typeof semanticResponse>;
    momentProtection: ReturnType<typeof semanticMomentProtection>;
    spectralPocket: ReturnType<typeof spectralConversationPocket>;
    control: ReturnType<typeof applySemanticControl>;
    hardwareBoundary: ReturnType<typeof semanticHardwareBoundary>;
}

export interface DirectorActiveBeatMeshV2 {
    committee: ReturnType<typeof queryByCommittee>;
    annotationValue: number;
    teaching: ReturnType<typeof activeTeachingPrompt>;
    constrained: ReturnType<typeof applyBeatConstraints>;
    memory: ReturnType<typeof beatMeshMemory>;
    community: ReturnType<typeof trustedCommunityCorrection>;
    djPulse: ReturnType<typeof selectDjPulse>;
    implementation: typeof TOP_FIVE_IMPLEMENTATION;
    measurement: typeof TOP_FIVE_MEASUREMENT;
}

export interface DirectorAudioSourceResolutionPolicy {
    layers: typeof AUDIO_STACK_LAYERS;
    flacPolicy: typeof FLAC_POLICY;
    pipeline: ReturnType<typeof decodeProcessingPipeline>;
    source: ReturnType<typeof sourceResolution>;
    validation: ReturnType<typeof validateNativeResolution>;
}

export interface DirectorDspPrecisionGaplessPolicy {
    precision: ReturnType<typeof internalDspPrecision>;
    quantization: ReturnType<typeof finalQuantization>;
    sampleRate: ReturnType<typeof sampleRateLane>;
    bitPerfect: ReturnType<typeof bitPerfectBypass>;
    timeline: ReturnType<typeof canonicalContentTimeline>;
    gapless: ReturnType<typeof gaplessIntegrity>;
    immersiveDelivery: ReturnType<typeof immersiveDeliveryCapability>;
    resampler: typeof RESAMPLER_POLICY;
}

export interface DirectorImmersiveRenderingV1 {
    presentationName: ReturnType<typeof spatialPresentationName>;
    atmosValidation: ReturnType<typeof atmosDeliveryValidation>;
    backends: typeof IMMERSIVE_BACKENDS;
    openLab: typeof OPEN_IMMERSIVE_LAB;
    ffmpeg: ReturnType<typeof ffmpegRole>;
    truePeak: ReturnType<typeof truePeakGuard>;
    codecCritic: ReturnType<typeof codecRoundTripCritic>;
    renderRobustness: ReturnType<typeof immersiveRenderRobustness>;
    binauralQuality: number;
    stemPolicy: ReturnType<typeof spatialStemPolicy>;
    safeMode: ReturnType<typeof spatialSafeMode>;
}

export interface DirectorRealtimeDspRouteV3 {
    stretchTier: ReturnType<typeof stretchQualityTier>;
    stretchMaterial: ReturnType<typeof sectionAdaptiveStretch>;
    stretchBackend: ReturnType<typeof routeDspBackend>;
    resampleBackend: ReturnType<typeof routeDspBackend>;
    spatialBackend: ReturnType<typeof routeDspBackend>;
    route: ReturnType<typeof negotiateRoute>;
    prewarm: typeof DSP_PREWARM;
    routeStates: typeof ROUTE_CHANGE_STATES_V2;
    rendererChange: ReturnType<typeof rendererChange>;
    capabilities: ReturnType<typeof capabilityMatrix>;
}

export interface DirectorAudioIntegrityQoeV1 {
    cache: ReturnType<typeof losslessCacheStrategy>;
    masterHash: string;
    pcmIntegrity: ReturnType<typeof pcmIntegrityTest>;
    nullTest: ReturnType<typeof dspNullTest>;
    codecBenchmark: ReturnType<typeof codecRoundTripBenchmark>;
    renderBenchmark: ReturnType<typeof renderMatrixBenchmark>;
    spatialHandoff: ReturnType<typeof spatialHandoffPolicy>;
    collision: ReturnType<typeof immersiveCollision>;
    dspTier: ReturnType<typeof minimumDspTier>;
    deliveryQoe: ReturnType<typeof codecAwareQoe>;
    hierarchy: typeof BEATCORD_QUALITY_HIERARCHY;
}

export interface DirectorTransformFidelityLedgerV2 {
    ac4: typeof AC4_RESEARCH_POLICY;
    metadata: ReturnType<typeof metadataPreservationTest>;
    ledger: ReturnType<typeof sourceFidelityLedger>;
    postRendererCritic: ReturnType<typeof postRendererTransitionCritic>;
    automation: ReturnType<typeof renderSpecificAutomation>;
    portableTransition: PortableSpatialTransitionV1;
    dependency: ReturnType<typeof dependencyCapability>;
    stretchRoute: ReturnType<typeof stretchRoute>;
    artifactRepair: string;
    resampling: ReturnType<typeof resamplingGraph>;
    fidelity: ReturnType<typeof fidelityStatus>;
    routeMatrix: typeof AUDIO_ROUTE_TEST_MATRIX_V2;
}

export interface DirectorFidelitySpatialV1 {
    utility: ReturnType<typeof fidelityAwareUtility>;
    artisticIntegrity: ReturnType<typeof spatialArtisticIntegrity>;
    nativeTransition: ReturnType<typeof nativeSpatialTransition>;
    roleMatch: ReturnType<typeof matchSceneRoles>;
    collision: ReturnType<typeof spatialSceneCollision>;
    downmix: ReturnType<typeof spatialDownmixCritic>;
    openPrototype: typeof OPEN_IMMERSIVE_PROTOTYPE;
    experiments: typeof AUDIO_RESEARCH_EXPERIMENTS_V2;
    evidenceRule: ReturnType<typeof evidenceUse>;
    backendStrategy: typeof FORMAT_BACKEND_STRATEGY;
}

export interface DirectorAudioFidelitySuiteV4 {
    architecture: typeof AUDIO_ARCHITECTURE_V4;
    independence: typeof CODEC_SPATIAL_INDEPENDENCE;
    phases: typeof AUDIO_IMPLEMENTATION_PHASES_V4;
    suite: typeof AUDIO_FIDELITY_SUITE_V4;
    currentBenchmark: ReturnType<typeof fidelityBenchResult>;
    guardian: ReturnType<typeof qualityGuardianV4>;
    priorities: typeof AUDIO_RESEARCH_PRIORITY_V4;
}

export interface DirectorPresentationTransportV1 {
    requirements: ReturnType<typeof contextRequirements>;
    compilation: ReturnType<typeof compilePresentation>;
    score: number;
    leAudio: typeof LE_AUDIO_BASELINE;
    auracast: ReturnType<typeof auracastArchitecture>;
    planes: typeof CONTROL_AUDIO_PLANE_ARCHITECTURE;
    lc3plus: ReturnType<typeof lc3plusPolicy>;
    wireless: ReturnType<typeof wirelessCapability>;
    opus: ReturnType<typeof opusRemotePolicy>;
}

export interface DirectorDeadlineTransportV2 {
    recovery: ReturnType<typeof choosePacketRecovery>;
    protection: ReturnType<typeof momentAwareProtection>;
    scheduledMoment: ReturnType<typeof scheduleMediaObject>;
    resynchronization: ReturnType<typeof beatSafeResynchronization>;
    program: ReturnType<typeof compilePresentationProgram>;
    safeRecovery: ReturnType<typeof transportRecoveryPolicy>;
    sessionFabric: typeof SESSION_FABRIC_V2;
    benchmarks: typeof TRANSPORT_BENCHMARK_SUITE_V2;
}

export interface DirectorPlatformEvidenceRealtimeV1 {
    creatorPermission: ReturnType<typeof creatorPermission>;
    analysisRequest: ReturnType<typeof appleAnalysisRequest>;
    evidenceFusion: ReturnType<typeof fuseMusicalEvidence>;
    modelAdmission: ReturnType<typeof admitRealtimeModel>;
    telemetry: ReturnType<typeof deadlineTelemetry>;
    topology: typeof APPLE_REALTIME_TOPOLOGY_V1;
    benchmark: typeof MUSIC_UNDERSTANDING_BENCH_V1;
}

export interface DirectorTransitionValidationLabV4 {
    critic: ReturnType<typeof transitionCriticV4>;
    preferences: ReturnType<typeof preferenceGraph>;
    mixPointPrior: number;
    shipGate: ReturnType<typeof transitionLabShipGate>;
    program: typeof TRANSITION_LAB_V4;
}

export interface DirectorBeatMeshValidationV3 {
    safetyGain: number;
    complexityRoi: number;
    deployment: ReturnType<typeof beatMeshDeploymentDecision>;
    failureClasses: typeof BEAT_MESH_FAILURE_CLASSES_V3;
    program: typeof BEAT_MESH_VALIDATION_V3;
}

export type DirectorBeatMeshTortureLabV1 = ValidationRuntimeV1["beatMeshTortureLabV1"];
export type DirectorStemTransitionUtilityV1 = ValidationRuntimeV1["stemTransitionUtilityV1"];
export type DirectorLongitudinalTasteLabV1 = ValidationRuntimeV1["longitudinalTasteLabV1"];
export type DirectorHumanInterventionLabV1 = ValidationRuntimeV1["humanInterventionLabV1"];

export interface DirectorCandidateScore {
    type: TransitionType;
    plannerScore: number;
    /** Auditable musical inputs; genre is capped at ten percent. */
    signals: TransitionSignalScores;
    communityPriorities: CommunityPriorityAssessment;
    directorScore?: number;
    eligible: boolean;
    selected: boolean;
    reasons: string[];
    rejection?: string;
    perceptualMaskingRisk?: number;
    perceptualMaskingRecommendation?: PerceptualMaskingAssessment["recommendation"];
    stretchRisk?: number;
    stretchMaterial?: StretchDecision["material"];
    stretchAllowed?: boolean;
    noveltyPenalty?: number;
    effectFatiguePenalty?: number;
    strategyFatigue?: StrategyFatigue;
    surpriseBudget?: SurpriseBudget;
}

export interface DirectorShadowDecision {
    policy: "planner-score-baseline-v1";
    selectedType: TransitionType;
    selectedScore: number;
    differsFromProduction: boolean;
}

export interface DirectorDecisionLog {
    version: 1;
    id: string;
    timestamp: number;
    inputStateHash: string;
    fromTrackId: string;
    toTrackId: string;
    candidateScores: DirectorCandidateScore[];
    selectedPlan: TransitionPlan;
    experience: ExperienceId;
    experienceResolved: ConcreteExperienceId;
    sessionPhase: SessionPhase;
    journey?: SessionJourneyPlan;
    communityPriorities?: CommunityPriorityAssessment;
    architecture?: BeatcordArchitectureStatus;
    research?: ResearchDecisionProvenance;
    principles?: ResearchPrincipleCompliance;
    researchLandscape?: SecondDepthResearchLandscape;
    performanceStyle?: PerformanceStyleSelection;
    progressivePlan?: ProgressiveTransitionPlan;
    musicalIntelligence?: JourneyIntelligence;
    vision?: UltimateVisionDecision;
    journeyTemplate?: JourneyTemplatePosition;
    familiarity?: FamiliarityState;
    surpriseBudget?: SurpriseBudget;
    strategyFatigue?: StrategyFatigue;
    tension?: { sections: ReturnType<typeof analyzeMusicalTension>; cut: PayoffCutAssessment };
    loopability?: Loopability | null;
    emergencyContinuity?: EmergencyContinuityPlan;
    backtiming?: BacktimingPlan | null;
    continuityPolicy?: ContinuityPolicy;
    policyDecision?: DirectorPolicyDecision;
    unifiedQuality?: UnifiedQualityGuardianResult;
    advancedExperience?: AdvancedExperienceDimensions;
    whyThis?: WhyThisExplanation;
    intelligenceBoundary?: IntelligenceBoundaryDecision[];
    learningSessionMode?: LearningSessionMode;
    groupRules?: PhaseGroupRules;
    recommendationV2?: RecommendationV2Audit;
    affect?: AffectState;
    crowdGovernance?: DirectorCrowdGovernance;
    recommendationGovernance?: DirectorRecommendationGovernance;
    researchGovernance?: DirectorResearchGovernance;
    materialIntelligence?: DirectorMaterialIntelligence;
    grooveCrowdIntelligence?: DirectorGrooveCrowdIntelligence;
    exposureContext?: DirectorExposureContext;
    performancePolicy?: DirectorPerformancePolicy;
    beatgridV2?: DirectorBeatgridV2;
    clubV3?: DirectorClubV3;
    realtimeReliability?: DirectorRealtimeReliability;
    psychoacousticCritic?: DirectorPsychoacousticCritic;
    transitionCriticV2?: DirectorTransitionCriticV2;
    conversationPolicy?: DirectorConversationPolicy;
    tastePrivacy?: DirectorTastePrivacy;
    qualityGuardianV3?: DirectorQualityGuardianV3;
    evaluationReliabilityV2?: DirectorEvaluationReliabilityV2;
    semanticIntelligence?: DirectorSemanticIntelligence;
    safeListening?: DirectorSafeListening;
    distributedRecovery?: DirectorDistributedRecovery;
    rightsPlanning?: DirectorRightsPlanning;
    temporalAgent?: DirectorTemporalAgent;
    stemSequential?: DirectorStemSequential;
    provenanceSignal?: DirectorProvenanceSignal;
    momentCompute?: DirectorMomentCompute;
    artistEcosystem?: DirectorArtistEcosystem;
    artistAnalytics?: DirectorArtistAnalytics;
    artistGovernance?: DirectorArtistGovernance;
    sessionContinuity?: DirectorSessionContinuity;
    crossProviderIdentity?: DirectorCrossProviderIdentity;
    socialSession?: DirectorSocialSession;
    experienceIntegration?: DirectorExperienceIntegration;
    mobilityKaraokeMemory?: DirectorMobilityKaraokeMemory;
    socialPrivacyUx?: DirectorSocialPrivacyUx;
    integrationSdkAccessibility?: DirectorIntegrationSdkAccessibility;
    platformResilience?: DirectorPlatformResilience;
    contextSerendipityTrust?: DirectorContextSerendipityTrust;
    qualityOfExperience?: DirectorQualityOfExperience;
    experienceQoeGovernance?: DirectorExperienceQoeGovernance;
    providerInnovation?: DirectorProviderInnovation;
    validatedInnovations?: DirectorValidatedInnovations;
    productStrategy?: DirectorProductStrategy;
    businessValidation?: DirectorBusinessValidation;
    adaptiveBeatMesh?: DirectorAdaptiveBeatMesh;
    hierarchicalStemMixing?: DirectorHierarchicalStemMixing;
    robustTransitionFunnel?: DirectorRobustTransitionFunnel;
    analyzerKnowledge?: DirectorAnalyzerKnowledge;
    musicalCompiler?: DirectorMusicalCompiler;
    perceptualPlayback?: DirectorPerceptualPlayback;
    causalTaste?: DirectorCausalTaste;
    explorationUncertaintyTeaching?: DirectorExplorationUncertaintyTeaching;
    stemComputeProvenanceV2?: DirectorStemComputeProvenanceV2;
    multisensoryAttentionExperience?: DirectorMultisensoryAttentionExperience;
    playbackTwinCausalLedgerV2?: DirectorPlaybackTwinCausalLedgerV2;
    causalDecisionConfidenceV3?: DirectorCausalDecisionConfidenceV3;
    semanticListeningV1?: DirectorSemanticListeningV1;
    activeBeatMeshV2?: DirectorActiveBeatMeshV2;
    audioSourceResolutionPolicy?: DirectorAudioSourceResolutionPolicy;
    dspPrecisionGaplessPolicy?: DirectorDspPrecisionGaplessPolicy;
    immersiveRenderingV1?: DirectorImmersiveRenderingV1;
    realtimeDspRouteV3?: DirectorRealtimeDspRouteV3;
    audioIntegrityQoeV1?: DirectorAudioIntegrityQoeV1;
    transformFidelityLedgerV2?: DirectorTransformFidelityLedgerV2;
    fidelitySpatialV1?: DirectorFidelitySpatialV1;
    audioFidelitySuiteV4?: DirectorAudioFidelitySuiteV4;
    presentationTransportV1?: DirectorPresentationTransportV1;
    deadlineTransportV2?: DirectorDeadlineTransportV2;
    platformEvidenceRealtimeV1?: DirectorPlatformEvidenceRealtimeV1;
    transitionValidationLabV4?: DirectorTransitionValidationLabV4;
    beatMeshValidationV3?: DirectorBeatMeshValidationV3;
    beatMeshTortureLabV1?: DirectorBeatMeshTortureLabV1;
    stemTransitionUtilityV1?: DirectorStemTransitionUtilityV1;
    longitudinalTasteLabV1?: DirectorLongitudinalTasteLabV1;
    humanInterventionLabV1?: DirectorHumanInterventionLabV1;
    runtimeEvidence?: RuntimeEvidenceSummaryV1;
    analyzerVersions: Record<string, string>;
    directorVersion: string;
    seed: number;
    shadow: DirectorShadowDecision;
    perceptualMasking?: PerceptualMaskingAssessment;
    stretchDecision?: StretchDecision;
    regionSelection?: TransitionRegionSelection;
    compatibility?: TrackCompatibility;
    compatibilityRoute?: TrackCompatibilityRoute;
    fatigue?: FatigueState;
    noveltyBudget?: TransitionNoveltyBudget;
    latency?: LatencyPlanningAssessment;
    override?: TransitionOverrideAudit;
}

export interface MusicDirectorState {
    experience: ExperienceSelection;
    session: SessionContext;
    journey: SessionJourneyPlan;
    taste: TasteProfile;
    fatigue: FatigueState;
    journeyTemplate: JourneyTemplatePosition;
    familiarity: FamiliarityState;
    override?: TransitionOverride;
    replay?: SessionReplayState;
}

export interface SessionReplayState {
    active: true;
    progress: number;
    targetEnergy: number;
    sourceCreatedAtMs: number;
}

export interface TasteProfile {
    transitionIntensity: number;
    originalPreservation: number;
    bassTransitionBias: number;
    vocalOverlap: number;
    tempoTolerance: number;
    energyVariance: number;
    confidence: number;
    samples: number;
}

export interface SessionFingerprint {
    version: 1;
    createdAtMs: number;
    experienceDNA: {
        weights: Record<ConcreteExperienceId, number>;
        intensity: number;
        targetEnergy: number;
    };
    energyCurve: number[];
    genreDistribution: Record<string, number>;
    familiarityTarget: number;
    mixPersonality: {
        transitionIntensity: number;
        originalPreservation: number;
        bassTransitionBias: number;
        vocalOverlap: number;
        tempoTolerance: number;
        energyVariance: number;
    };
    transitionDistribution: Partial<Record<TransitionType, number>>;
    confidence: number;
    sampleSize: number;
}

export const MUSIC_DIRECTOR_SNAPSHOT_VERSION = 1 as const;

/** Durable, user-specific learning state. Explicit experience intent is session-only. */
export interface MusicDirectorSnapshot {
    version: typeof MUSIC_DIRECTOR_SNAPSHOT_VERSION;
    savedAtMs: number;
    taste: TasteProfile;
    memory: MusicalMemory;
    userSkips: number;
    userLikes: number;
}

export interface TrackSelectionScore {
    profile: TrackProfile;
    score: number;
    reasons: string[];
    penalties: string[];
    compatibility: TrackCompatibility;
    route: TrackCompatibilityRoute;
    recommendation: RankedRecommendation<TrackProfile>;
    hybridRecommendation: ReturnType<typeof hybridRecommendationScore>;
}

export interface MusicDirectorOptions {
    now?: () => number;
    capabilities?: PlaybackCapabilities;
    learningSessionMode?: LearningSessionMode;
}

interface ExperienceEvolution {
    from: ExperienceSelection;
    startedAtMs: number;
    durationMs: number;
}

interface ActiveSessionReplay {
    fingerprint: SessionFingerprint;
    startedAtEnergyIndex: number;
}

const HARD_ENTRY = new Set<TransitionType>(["spinback", "roll", "cut", "bassdrop"]);
const HARMONIC_OVERLAP = new Set<TransitionType>(["blend", "filter", "acapella"]);
const EXPERIENCE_IDS: ConcreteExperienceId[] = ["chill", "love", "energy", "party"];
const DIRECTOR_VERSION = "music-director-v42-evidence-calibration-runtime";
const ANALYZER_VERSIONS = {
    trackProfile: "track-profile-v3-musical-timeline",
    transitionCandidates: "transition-candidates-v3-genre-signal",
    experienceEngine: "experience-engine-v1",
    perceptualMasking: "perceptual-masking-v1",
    adaptiveStretch: "adaptive-stretch-v1",
    mixRegions: "mix-regions-v1",
    trackCompatibility: "track-compatibility-v2-tempo-awareness",
    sessionFatigue: "session-fatigue-v1",
    humanOverride: "transition-override-v1",
    stemQualityGate: "stem-quality-gate-v2",
    analysisCache: "analysis-cache-v1",
    confidenceFusion: "confidence-fusion-v1",
    tempoAwareness: "tempo-awareness-v1",
    genreSignal: "genre-signal-v1",
    sessionJourney: "session-journey-v1",
    communityPriorities: "community-priorities-v1",
    architectureStatus: "architecture-status-v1",
    researchRegistry: "research-registry-v1",
    researchPrinciples: "research-principles-v1",
    performanceStyle: "performance-style-v1",
    progressivePlanning: "progressive-planning-v1",
    musicalTimeline: "musical-timeline-v1",
    dynamicBeatgrid: "dynamic-beatgrid-v1",
    sharedAnalysis: "track-profile-shared-v1",
    sectionImportance: "section-importance-v1",
    structuralDependencies: "structural-dependencies-v1",
    ultimateVision: "ultimate-vision-v1",
    musicalTension: "musical-tension-v1",
    loopability: "loopability-v1",
    emergencyContinuity: "emergency-continuity-v1",
    backtiming: "backtiming-v1",
    journeyTemplates: "journey-templates-v1",
    familiarityBalance: "familiarity-balance-v1",
    surpriseBudget: "surprise-budget-v1",
    strategyFatigue: "strategy-fatigue-v1",
    trackIdentity: "track-identity-v1",
    albumIntegrity: "album-integrity-v1",
    capabilityLayer: "provider-capabilities-v1",
    policyEngine: "director-policy-v1",
    unifiedQuality: "unified-quality-guardian-v1",
    advancedExperience: "advanced-experience-v1",
    recommendationStack: "recommendation-stack-v1",
    learningGovernance: "learning-governance-v1",
    groupRecommendation: "group-recommendation-v1",
    hybridRecommendation: "hybrid-recommendation-v1",
    tasteDynamics: "taste-dynamics-v1",
    recommendationRouting: "recommendation-routing-v2",
    evidenceSequencing: "evidence-sequencing-v1",
    affectIntelligence: "affect-intelligence-v1",
    crowdExperience: "crowd-experience-v2",
    responsibleRecommendation: "responsible-recommendation-v1",
    crowdIntentContract: "crowd-intent-contract-v1",
    culturalGenreTrends: "cultural-genre-trends-v1",
    temporalRecommendationResearch: "temporal-recommendation-research-v1",
    transitionMaterialIntelligence: "transition-material-intelligence-v1",
    grooveCrowdIntelligence: "groove-crowd-intelligence-v1",
    exposureContextIntelligence: "exposure-context-intelligence-v1",
    perceptualPerformancePolicy: "perceptual-performance-policy-v1",
    beatgridIntelligence: "beatgrid-intelligence-v2",
    clubTransitionPlanner: "club-transition-planner-v2",
    clubPerformanceValidation: "club-performance-validation-v1",
    realtimeAudioReliability: "realtime-audio-reliability-v1",
    psychoacousticTransitionCritic: "psychoacoustic-transition-critic-v1",
    transitionCriticV2: "transition-critic-v2",
    conversationalDirector: "conversational-director-v1",
    tastePrivacyGovernance: "taste-privacy-governance-v1",
    qualityGuardianV3: "quality-guardian-v3",
    evaluationReliabilityV2: "evaluation-reliability-v2",
    semanticMusicIntelligence: "semantic-music-intelligence-v1",
    safeListeningAccessibility: "safe-listening-accessibility-v1",
    distributedAgentRecovery: "distributed-agent-recovery-v1",
    mixedPlaylistRights: "mixed-playlist-rights-v1",
    temporalAgentOrchestration: "temporal-agent-orchestration-v1",
    stemRestorationSequential: "stem-restoration-sequential-v1",
    provenanceSignalIntegrity: "provenance-signal-integrity-v1",
    momentComputeIntelligence: "moment-compute-intelligence-v1",
    artistEcosystemIntelligence: "artist-ecosystem-intelligence-v1",
    artistAnalyticsTransparency: "artist-analytics-transparency-v1",
    artistEcosystemGovernance: "artist-ecosystem-governance-v1",
    sessionContinuityPlatform: "session-continuity-platform-v1",
    crossProviderIdentity: "cross-provider-identity-v1",
    socialSessionGovernance: "social-session-governance-v1",
    experienceEventIntegration: "experience-event-integration-v1",
    mobilityKaraokeMemory: "mobility-karaoke-memory-v1",
    socialPrivacyJourneyUx: "social-privacy-journey-ux-v1",
    integrationSdkAccessibilitySearch: "integration-sdk-accessibility-search-v1",
    platformSearchSyncResilience: "platform-search-sync-resilience-v1",
    ecosystemMilestones: "ecosystem-milestones-v1",
    contextSerendipityTrust: "context-serendipity-trust-v1",
    qualityOfExperience: "quality-of-experience-v1",
    experienceQoeGovernance: "experience-qoe-governance-v1",
    providerInnovationValidation: "provider-innovation-validation-v1",
    validatedExperienceInnovations: "validated-experience-innovations-v1",
    productArchitectureStrategy: "product-architecture-strategy-v1",
    businessValidationGovernance: "business-validation-governance-v1",
    adaptiveBeatMesh: "adaptive-beat-mesh-v1",
    hierarchicalStemPerceptualMixing: "hierarchical-stem-perceptual-mixing-v1",
    robustTransitionFunnel: "robust-transition-funnel-v1",
    analyzerTransitionKnowledge: "analyzer-transition-knowledge-v1",
    musicalCompilerDeadlineRisk: "musical-compiler-deadline-risk-v1",
    perceptualPlaybackEmbodiment: "perceptual-playback-embodiment-v1",
    causalTasteFirewall: "causal-taste-firewall-v1",
    explorationUncertaintyTeaching: "exploration-uncertainty-teaching-v1",
    stemComputeProvenanceV2: "stem-compute-provenance-v2",
    multisensoryAttentionExperience: "multisensory-attention-experience-v1",
    playbackTwinCausalLedgerV2: "playback-twin-causal-ledger-v2",
    causalDecisionConfidenceV3: "causal-decision-confidence-v3",
    semanticListeningV1: "semantic-listening-v1",
    activeBeatMeshV2: "active-beat-mesh-v2",
    audioSourceResolutionPolicy: "audio-source-resolution-policy-v1",
    dspPrecisionGaplessPolicy: "dsp-precision-gapless-policy-v1",
    immersiveRenderingV1: "immersive-rendering-v1",
    realtimeDspRouteV3: "realtime-dsp-route-v3",
    audioIntegrityQoeV1: "audio-integrity-qoe-v1",
    transformFidelityLedgerV2: "transform-fidelity-ledger-v2",
    fidelitySpatialV1: "fidelity-spatial-director-v1",
    audioFidelitySuiteV4: "audio-fidelity-suite-v4",
    presentationTransportV1: "presentation-transport-compiler-v1",
    deadlineTransportV2: "deadline-transport-runtime-v2",
    platformEvidenceRealtimeV1: "platform-evidence-realtime-v1",
    transitionValidationLabV4: "transition-validation-lab-v4",
    beatMeshValidationV3: "beat-mesh-validation-v3",
    beatMeshTortureLabV1: "beat-mesh-torture-lab-v1",
    stemTransitionUtilityV1: "stem-transition-utility-v1",
    longitudinalTasteLabV1: "longitudinal-taste-lab-v1",
    humanInterventionLabV1: "human-intervention-lab-v1",
    runtimeEvidenceV1: "runtime-evidence-ledger-v1",
};
const COMPLEXITY: Record<TransitionType, number> = {
    fade: 0.08,
    blend: 0.35,
    cut: 0.28,
    echo: 0.38,
    filter: 0.48,
    bassdrop: 0.62,
    gate: 0.65,
    riser: 0.66,
    spinback: 0.72,
    roll: 0.76,
    acapella: 0.92,
};
const REQUIRED_CONFIDENCE: Record<TransitionType, number> = {
    fade: 0.05,
    blend: 0.28,
    cut: 0.34,
    echo: 0.3,
    filter: 0.42,
    bassdrop: 0.58,
    gate: 0.58,
    riser: 0.58,
    spinback: 0.62,
    roll: 0.68,
    acapella: 0.78,
};
const STYLE_AFFINITY: Record<Exclude<ExperienceId, "auto">, Record<TransitionType, number>> = {
    chill: {
        fade: 1,
        blend: 0.68,
        cut: 0.25,
        echo: 0.72,
        filter: 0.5,
        bassdrop: 0.15,
        gate: 0.12,
        riser: 0.12,
        spinback: 0.02,
        roll: 0.05,
        acapella: 0.35,
    },
    love: {
        fade: 0.95,
        blend: 0.82,
        cut: 0.3,
        echo: 0.76,
        filter: 0.62,
        bassdrop: 0.25,
        gate: 0.18,
        riser: 0.22,
        spinback: 0.04,
        roll: 0.08,
        acapella: 0.52,
    },
    energy: {
        fade: 0.25,
        blend: 0.75,
        cut: 0.88,
        echo: 0.55,
        filter: 0.78,
        bassdrop: 0.94,
        gate: 0.82,
        riser: 0.92,
        spinback: 0.78,
        roll: 0.86,
        acapella: 0.58,
    },
    party: {
        fade: 0.18,
        blend: 0.94,
        cut: 0.76,
        echo: 0.67,
        filter: 0.9,
        bassdrop: 1,
        gate: 0.88,
        riser: 0.96,
        spinback: 0.82,
        roll: 0.9,
        acapella: 0.92,
    },
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;

function compatibilityTarget(experience: ExperienceSelection, session: SessionContext): CompatibilityTarget {
    switch (experience.resolved) {
        case "chill":
            return { energy: session.targetEnergy, valence: 0.58, danceability: 0.3, acousticness: 0.72 };
        case "love":
            return { energy: session.targetEnergy, valence: 0.72, danceability: 0.45, acousticness: 0.62 };
        case "energy":
            return { energy: session.targetEnergy, valence: 0.64, danceability: 0.82, acousticness: 0.22 };
        case "party":
            return { energy: session.targetEnergy, valence: 0.72, danceability: 0.9, acousticness: 0.15 };
    }
}

/** Small deterministic hash for replay identity; not intended for security. */
export function hashDirectorInput(input: unknown): string {
    const text = JSON.stringify(input) ?? "undefined";
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

const DEFAULT_TASTE: TasteProfile = {
    transitionIntensity: 0.5,
    originalPreservation: 0.65,
    bassTransitionBias: 0.5,
    vocalOverlap: 0.12,
    tempoTolerance: 0.08,
    energyVariance: 0.5,
    confidence: 0,
    samples: 0,
};

const TRANSITION_TYPES = new Set<TransitionType>([
    "fade",
    "blend",
    "cut",
    "echo",
    "filter",
    "bassdrop",
    "gate",
    "riser",
    "spinback",
    "roll",
    "acapella",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
    return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function stringHistory(value: unknown, max = 12): string[] {
    if (!Array.isArray(value)) return [];
    return limit(
        value
            .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
            .map((entry) => entry.slice(0, 256)),
        max,
    );
}

function numberHistory(value: unknown, min: number, max: number, historyMax = 12): number[] {
    if (!Array.isArray(value)) return [];
    return limit(
        value
            .filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
            .map((entry) => Math.min(max, Math.max(min, entry))),
        historyMax,
    );
}

function optionalTimestamp(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function transitionHistory(value: unknown): TransitionHistoryEntry[] {
    if (!Array.isArray(value)) return [];
    const entries: TransitionHistoryEntry[] = [];
    for (const raw of value) {
        if (!isRecord(raw)) continue;
        const type = raw.type;
        if (
            typeof raw.fromTrackId !== "string" ||
            !raw.fromTrackId ||
            typeof raw.toTrackId !== "string" ||
            !raw.toTrackId ||
            typeof type !== "string" ||
            !TRANSITION_TYPES.has(type as TransitionType)
        ) {
            continue;
        }
        const outcome = raw.outcome === "played" || raw.outcome === "skipped" ? raw.outcome : undefined;
        entries.push({
            atMs: finiteNumber(raw.atMs, 0, 0, Number.MAX_SAFE_INTEGER),
            fromTrackId: raw.fromTrackId.slice(0, 256),
            toTrackId: raw.toTrackId.slice(0, 256),
            type: type as TransitionType,
            confidence: finiteNumber(raw.confidence, 0, 0, 1),
            ...(outcome ? { outcome } : {}),
        });
    }
    return limit(entries, 40);
}

function normalizedDistribution(value: unknown, allowed?: ReadonlySet<string>): Record<string, number> {
    if (!isRecord(value)) return {};
    const entries = Object.entries(value)
        .filter(
            ([key, weight]) =>
                (!allowed || allowed.has(key)) && typeof weight === "number" && Number.isFinite(weight) && weight > 0,
        )
        .slice(0, 64);
    const total = entries.reduce((sum, [, weight]) => sum + (weight as number), 0);
    if (total <= 0) return {};
    return Object.fromEntries(entries.map(([key, weight]) => [key.slice(0, 128), (weight as number) / total]));
}

/** Validate an external fingerprint before it can steer a live session. */
export function parseSessionFingerprint(value: unknown): SessionFingerprint | null {
    if (!isRecord(value) || value.version !== 1 || !isRecord(value.experienceDNA) || !isRecord(value.mixPersonality)) {
        return null;
    }
    const experienceWeights = normalizedDistribution(value.experienceDNA.weights, new Set(EXPERIENCE_IDS));
    if (!Object.keys(experienceWeights).length) return null;
    const weights = Object.fromEntries(EXPERIENCE_IDS.map((id) => [id, experienceWeights[id] ?? 0])) as Record<
        ConcreteExperienceId,
        number
    >;
    const curve = numberHistory(value.energyCurve, 0, 1, 64);
    if (!curve.length) return null;
    const genres = normalizedDistribution(value.genreDistribution);
    const transitions = normalizedDistribution(value.transitionDistribution, TRANSITION_TYPES);
    const mix = value.mixPersonality;
    return {
        version: 1,
        createdAtMs: finiteNumber(value.createdAtMs, 0, 0, Number.MAX_SAFE_INTEGER),
        experienceDNA: {
            weights,
            intensity: finiteNumber(value.experienceDNA.intensity, 1, 0, 1),
            targetEnergy: finiteNumber(value.experienceDNA.targetEnergy, 0.55, 0, 1),
        },
        energyCurve: curve,
        genreDistribution: genres,
        familiarityTarget: finiteNumber(value.familiarityTarget, 0.5, 0, 1),
        mixPersonality: {
            transitionIntensity: finiteNumber(mix.transitionIntensity, DEFAULT_TASTE.transitionIntensity, 0, 1),
            originalPreservation: finiteNumber(mix.originalPreservation, DEFAULT_TASTE.originalPreservation, 0, 1),
            bassTransitionBias: finiteNumber(mix.bassTransitionBias, DEFAULT_TASTE.bassTransitionBias, 0, 1),
            vocalOverlap: finiteNumber(mix.vocalOverlap, DEFAULT_TASTE.vocalOverlap, 0, 1),
            tempoTolerance: finiteNumber(mix.tempoTolerance, DEFAULT_TASTE.tempoTolerance, 0, 0.25),
            energyVariance: finiteNumber(mix.energyVariance, DEFAULT_TASTE.energyVariance, 0, 1),
        },
        transitionDistribution: transitions as Partial<Record<TransitionType, number>>,
        confidence: finiteNumber(value.confidence, 0, 0, 1),
        sampleSize: Math.floor(finiteNumber(value.sampleSize, curve.length, 0, 1_000_000)),
    };
}

function limit<T>(values: T[], max = 12): T[] {
    return values.slice(Math.max(0, values.length - max));
}

function planStyle(type: TransitionType, tempoRatio: number): TransitionIntentStyle {
    switch (type) {
        case "fade":
            return "fade";
        case "cut":
            return "cut";
        case "filter":
            return "filter";
        case "echo":
            return "echo";
        case "bassdrop":
            return "bass-swap";
        case "roll":
            return "loop";
        case "acapella":
            return "stem-mix";
        case "riser":
            return "drop";
        case "blend":
            return tempoRatio === 1 ? "blend" : "beatmatch";
        case "gate":
        case "spinback":
            return "cut";
    }
}

function phaseFor(ageMinutes: number, peakReached: boolean): SessionPhase {
    if (ageMinutes < 8) return "warmup";
    if (ageMinutes < 24) return "build";
    if (ageMinutes < 48) return "momentum";
    if (ageMinutes < 65) return "peak";
    if (ageMinutes < 75) return "reset";
    if (ageMinutes < 105) return "rebuild";
    if (ageMinutes < 135 || !peakReached) return "finale";
    return "cooldown";
}

function energyTarget(selection: ExperienceSelection, phase: SessionPhase): number {
    const offset: Record<SessionPhase, number> = {
        warmup: -0.12,
        build: -0.04,
        momentum: 0.02,
        peak: 0.1,
        reset: -0.14,
        rebuild: -0.03,
        finale: 0.06,
        cooldown: -0.18,
    };
    return clamp01(selection.vector.targetEnergy + offset[phase] * selection.vector.dynamicVariation);
}

function fusedConfidence(a: TrackProfile, b: TrackProfile): number {
    const minimum = Math.min(a.confidence.overall, b.confidence.overall);
    const average = (a.confidence.overall + b.confidence.overall) / 2;
    return clamp01(minimum * 0.65 + average * 0.35);
}

function manipulationBudget(
    current: TrackProfile,
    next: TrackProfile,
    experience: ExperienceSelection,
    performance: PerformanceStyleSelection,
    confidence: number,
): ManipulationBudget {
    const acoustic = (current.acousticness + next.acousticness) / 2;
    const vocal = (current.vocalness + next.vocalness) / 2;
    const genreElectronic = [current, next].filter((profile) => profile.genres[0]?.genre === "edm").length / 2;
    const permission = clamp01(
        0.18 +
            performance.style.manipulation * 0.42 +
            genreElectronic * 0.25 -
            acoustic * 0.24 -
            vocal * experience.vector.preserveSongStructure * 0.12,
    );
    const total = clamp01(permission * (0.45 + confidence * 0.55));
    return {
        total,
        timeStretch: clamp01(total * performance.style.tempoFlexibility * 1.35),
        pitchShift: clamp01(total * 0.35),
        looping: clamp01(total * (1 - performance.style.structurePreservation)),
        stemMixing: clamp01(
            total * performance.style.stemUsage * Math.min(current.confidence.stems, next.confidence.stems || 1),
        ),
        structureEditing: clamp01(total * (1 - performance.style.structurePreservation)),
        effects: clamp01(total * performance.style.effectIntensity),
    };
}

function adjustedFade(base: number, selection: ExperienceSelection, max: number): number {
    const factor = { short: 0.68, medium: 1, "medium-long": 1.4, phrase: 1.65 }[
        selection.vector.preferredTransitionLength
    ];
    return round(Math.max(1, Math.min(max, base * factor)), 3);
}

export class MusicDirector {
    #requested: ExperienceId = "auto";
    #intensity = 1;
    #blend: Partial<Record<ConcreteExperienceId, number>> | undefined;
    #startedAt: number;
    #now: () => number;
    #evolution: ExperienceEvolution | null = null;
    #replay: ActiveSessionReplay | null = null;
    #seenTrackIds = new Set<string>();
    #memory: MusicalMemory = {
        recentArtists: [],
        recentGenres: [],
        recentKeys: [],
        recentBpms: [],
        vocalDensityHistory: [],
        energyHistory: [],
        transitionHistory: [],
    };
    #skips = 0;
    #likes = 0;
    #lastAuto: ExperienceSelection | null = null;
    #taste: TasteProfile = { ...DEFAULT_TASTE };
    #snapshotListener: ((snapshot: MusicDirectorSnapshot) => void) | null = null;
    #override: TransitionOverride | null = null;
    #performanceStyleOverride: PerformanceStyleOverride | null = null;
    #timedMoment: TimedMomentRequest | null = null;
    #capabilities: PlaybackCapabilities;
    #learningSessionMode: LearningSessionMode;
    #runtimeEvidence: RuntimeEvidenceSummaryV1;

    constructor(options: MusicDirectorOptions = {}) {
        this.#now = options.now ?? Date.now;
        this.#startedAt = this.#now();
        this.#capabilities = { ...(options.capabilities ?? FULL_PLAYBACK_CAPABILITIES) };
        this.#learningSessionMode = options.learningSessionMode ?? "personal";
        this.#runtimeEvidence = emptyRuntimeEvidenceSummary(this.#startedAt);
    }

    setPlaybackCapabilities(capabilities: PlaybackCapabilities): void {
        this.#capabilities = { ...capabilities };
    }

    get playbackCapabilities(): PlaybackCapabilities {
        return { ...this.#capabilities };
    }

    setLearningSessionMode(mode: LearningSessionMode): void {
        this.#learningSessionMode = mode;
    }

    get learningSessionMode(): LearningSessionMode {
        return this.#learningSessionMode;
    }

    setRuntimeEvidence(summary: RuntimeEvidenceSummaryV1): void {
        this.#runtimeEvidence = cloneRuntimeEvidenceSummary(summary);
    }

    get runtimeEvidence(): RuntimeEvidenceSummaryV1 {
        return cloneRuntimeEvidenceSummary(this.#runtimeEvidence);
    }

    /** Receive coalescible persistence notifications whenever durable state changes. */
    setSnapshotListener(listener: ((snapshot: MusicDirectorSnapshot) => void) | null): void {
        this.#snapshotListener = listener;
    }

    setTransitionOverride(override: TransitionOverride): void {
        this.#override = override;
    }

    clearTransitionOverride(): void {
        this.#override = null;
    }

    /** Advanced session-only control; emotional experience remains unchanged. */
    setPerformanceStyle(override: PerformanceStyleOverride | null): void {
        this.#performanceStyleOverride = override
            ? { ...override, ...(override.style ? { style: { ...override.style } } : {}) }
            : null;
    }

    get performanceStyleOverride(): PerformanceStyleOverride | null {
        return this.#performanceStyleOverride
            ? {
                  ...this.#performanceStyleOverride,
                  ...(this.#performanceStyleOverride.style
                      ? { style: { ...this.#performanceStyleOverride.style } }
                      : {}),
              }
            : null;
    }

    setTimedMoment(request: TimedMomentRequest | null): void {
        this.#timedMoment = request ? { ...request } : null;
    }

    get timedMoment(): TimedMomentRequest | null {
        return this.#timedMoment ? { ...this.#timedMoment } : null;
    }

    consumeTransitionOverride(overrideId: string): boolean {
        if (this.#override?.id !== overrideId || this.#override.scope !== "next") return false;
        this.#override = null;
        return true;
    }

    get transitionOverride(): TransitionOverride | null {
        return this.#override ? { ...this.#override, neverMixRegions: [...this.#override.neverMixRegions] } : null;
    }

    exportSnapshot(): MusicDirectorSnapshot {
        return {
            version: MUSIC_DIRECTOR_SNAPSHOT_VERSION,
            savedAtMs: this.#now(),
            taste: { ...this.#taste },
            memory: {
                ...(this.#memory.lastEnergyPeakAt !== undefined
                    ? { lastEnergyPeakAt: this.#memory.lastEnergyPeakAt }
                    : {}),
                ...(this.#memory.lastMajorDropAt !== undefined
                    ? { lastMajorDropAt: this.#memory.lastMajorDropAt }
                    : {}),
                ...(this.#memory.lastBreatherAt !== undefined ? { lastBreatherAt: this.#memory.lastBreatherAt } : {}),
                recentArtists: [...this.#memory.recentArtists],
                recentGenres: [...this.#memory.recentGenres],
                recentKeys: [...this.#memory.recentKeys],
                recentBpms: [...this.#memory.recentBpms],
                vocalDensityHistory: [...this.#memory.vocalDensityHistory],
                energyHistory: [...this.#memory.energyHistory],
                transitionHistory: this.#memory.transitionHistory.map((entry) => ({ ...entry })),
            },
            userSkips: this.#skips,
            userLikes: this.#likes,
        };
    }

    /** Restore a known snapshot version, sanitizing corrupt fields and old partial V1 data. */
    restoreSnapshot(value: unknown): boolean {
        if (!isRecord(value) || value.version !== MUSIC_DIRECTOR_SNAPSHOT_VERSION) return false;
        const taste = isRecord(value.taste) ? value.taste : {};
        const memory = isRecord(value.memory) ? value.memory : {};
        const lastEnergyPeakAt = optionalTimestamp(memory.lastEnergyPeakAt);
        const lastMajorDropAt = optionalTimestamp(memory.lastMajorDropAt);
        const lastBreatherAt = optionalTimestamp(memory.lastBreatherAt);
        this.#taste = {
            transitionIntensity: finiteNumber(taste.transitionIntensity, DEFAULT_TASTE.transitionIntensity, 0, 1),
            originalPreservation: finiteNumber(taste.originalPreservation, DEFAULT_TASTE.originalPreservation, 0, 1),
            bassTransitionBias: finiteNumber(taste.bassTransitionBias, DEFAULT_TASTE.bassTransitionBias, 0, 1),
            vocalOverlap: finiteNumber(taste.vocalOverlap, DEFAULT_TASTE.vocalOverlap, 0, 1),
            tempoTolerance: finiteNumber(taste.tempoTolerance, DEFAULT_TASTE.tempoTolerance, 0, 0.25),
            energyVariance: finiteNumber(taste.energyVariance, DEFAULT_TASTE.energyVariance, 0, 1),
            confidence: finiteNumber(taste.confidence, DEFAULT_TASTE.confidence, 0, 1),
            samples: finiteNumber(taste.samples, DEFAULT_TASTE.samples, 0, 1_000_000),
        };
        this.#memory = {
            ...(lastEnergyPeakAt !== undefined ? { lastEnergyPeakAt } : {}),
            ...(lastMajorDropAt !== undefined ? { lastMajorDropAt } : {}),
            ...(lastBreatherAt !== undefined ? { lastBreatherAt } : {}),
            recentArtists: stringHistory(memory.recentArtists),
            recentGenres: stringHistory(memory.recentGenres),
            recentKeys: stringHistory(memory.recentKeys),
            recentBpms: numberHistory(memory.recentBpms, 1, 400),
            vocalDensityHistory: numberHistory(memory.vocalDensityHistory, 0, 1),
            energyHistory: numberHistory(memory.energyHistory, 0, 1),
            transitionHistory: transitionHistory(memory.transitionHistory),
        };
        this.#skips = Math.floor(finiteNumber(value.userSkips, 0, 0, 1_000_000));
        this.#likes = Math.floor(finiteNumber(value.userLikes, 0, 0, 1_000_000));
        this.#seenTrackIds.clear();
        this.#lastAuto = null;
        this.#evolution = null;
        this.#replay = null;
        this.#override = null;
        this.#performanceStyleOverride = null;
        this.#timedMoment = null;
        return true;
    }

    setExperience(
        experience: ExperienceId,
        intensity = 1,
        blend?: Partial<Record<ConcreteExperienceId, number>>,
    ): void {
        this.#requested = experience;
        this.#intensity = clamp01(intensity);
        this.#blend = blend;
        this.#evolution = null;
        this.#replay = null;
    }

    /** Move toward a new experience without a sudden change in musical policy. */
    evolveExperience(
        experience: ExperienceId,
        intensity = 1,
        blend?: Partial<Record<ConcreteExperienceId, number>>,
        durationSec = 120,
    ): void {
        const from = this.#resolveExperience([]);
        this.#replay = null;
        this.#requested = experience;
        this.#intensity = clamp01(intensity);
        this.#blend = blend;
        const durationMs = Math.max(0, durationSec * 1000);
        this.#evolution = durationMs > 0 ? { from, startedAtMs: this.#now(), durationMs } : null;
    }

    get requestedExperience(): ExperienceId {
        return this.#requested;
    }

    exportSessionFingerprint(profiles: readonly TrackProfile[] = []): SessionFingerprint {
        const state = this.state(profiles);
        const energyCurve = this.#memory.energyHistory.length
            ? [...this.#memory.energyHistory]
            : [state.session.currentEnergy, state.session.targetEnergy];
        const countDistribution = (values: readonly string[]) => {
            const counts: Record<string, number> = {};
            for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
            return normalizedDistribution(counts);
        };
        const transitionDistribution = countDistribution(
            this.#memory.transitionHistory.map((transition) => transition.type),
        ) as Partial<Record<TransitionType, number>>;
        const sampleSize = Math.max(energyCurve.length, this.#memory.transitionHistory.length);
        return {
            version: 1,
            createdAtMs: this.#now(),
            experienceDNA: {
                weights: { ...state.experience.weights },
                intensity: state.experience.intensity,
                targetEnergy: state.session.targetEnergy,
            },
            energyCurve,
            genreDistribution: countDistribution(this.#memory.recentGenres),
            familiarityTarget: 0.5,
            mixPersonality: {
                transitionIntensity: state.experience.vector.transitionIntensity,
                originalPreservation: state.experience.vector.preserveSongStructure,
                bassTransitionBias: this.#taste.bassTransitionBias,
                vocalOverlap: state.experience.vector.vocalOverlapTolerance,
                tempoTolerance: state.experience.vector.tempoManipulation * 0.08,
                energyVariance: state.experience.vector.dynamicVariation,
            },
            transitionDistribution,
            confidence: clamp01(0.25 + Math.min(0.5, sampleSize / 24) + this.#taste.confidence * 0.25),
            sampleSize,
        };
    }

    applySessionFingerprint(value: unknown, requestedExperience?: ExperienceId): boolean {
        const fingerprint = parseSessionFingerprint(value);
        if (!fingerprint) return false;
        const dominant = EXPERIENCE_IDS.reduce((best, id) =>
            fingerprint.experienceDNA.weights[id] > fingerprint.experienceDNA.weights[best] ? id : best,
        );
        this.#requested =
            requestedExperience &&
            (requestedExperience === "auto" || EXPERIENCE_IDS.includes(requestedExperience as ConcreteExperienceId))
                ? requestedExperience
                : dominant;
        this.#intensity = fingerprint.experienceDNA.intensity;
        this.#blend = { ...fingerprint.experienceDNA.weights };
        this.#evolution = null;
        this.#replay = {
            fingerprint,
            startedAtEnergyIndex: this.#memory.energyHistory.length,
        };
        return true;
    }

    clearSessionReplay(): void {
        this.#replay = null;
    }

    observeTrack(profile: TrackProfile, artist?: string | null): void {
        if (this.#seenTrackIds.has(profile.trackId)) return;
        this.#seenTrackIds.add(profile.trackId);
        if (this.#seenTrackIds.size > 2_048) {
            const oldest = this.#seenTrackIds.values().next().value;
            if (oldest !== undefined) this.#seenTrackIds.delete(oldest);
        }
        const now = this.#now();
        if (profile.energy >= 0.82) this.#memory.lastEnergyPeakAt = now;
        if (profile.drops?.length) this.#memory.lastMajorDropAt = now;
        if (profile.energy <= 0.38) this.#memory.lastBreatherAt = now;
        const resolvedArtist = artist ?? profile.artist;
        if (resolvedArtist) this.#memory.recentArtists = limit([...this.#memory.recentArtists, resolvedArtist]);
        this.#memory.recentGenres = limit([...this.#memory.recentGenres, profile.genres[0]?.genre ?? "unknown"]);
        this.#memory.recentKeys = limit([...this.#memory.recentKeys, profile.key]);
        this.#memory.recentBpms = limit([...this.#memory.recentBpms, profile.bpm]);
        this.#memory.vocalDensityHistory = limit([...this.#memory.vocalDensityHistory, profile.vocalness]);
        this.#memory.energyHistory = limit([...this.#memory.energyHistory, profile.energy]);
        this.#notifySnapshotChanged();
    }

    recordOutcome(outcome: "played" | "skipped", weight = 1): void {
        const evidenceWeight = clamp01(weight);
        if (evidenceWeight <= 0) return;
        if (outcome === "skipped") this.#skips++;
        else this.#likes++;
        const latest = this.#memory.transitionHistory.at(-1);
        if (latest) latest.outcome = outcome;
        const governed = governLearningSignal(
            outcome === "skipped" ? "skip" : "passive-listening",
            this.#learningSessionMode,
        );
        if (!governed.persistPersonal) {
            this.#notifySnapshotChanged();
            return;
        }
        const learningRate = Math.max(0.012, 0.06 / Math.sqrt(this.#taste.samples + 1)) * evidenceWeight;
        const complex = latest ? COMPLEXITY[latest.type] : 0.4;
        if (outcome === "skipped") {
            this.#taste.transitionIntensity = clamp01(this.#taste.transitionIntensity - learningRate * complex);
            this.#taste.originalPreservation = clamp01(this.#taste.originalPreservation + learningRate);
            this.#taste.vocalOverlap = clamp01(this.#taste.vocalOverlap - learningRate * 0.35);
            this.#taste.tempoTolerance = clamp01(this.#taste.tempoTolerance - learningRate * 0.08);
            this.#taste.energyVariance = clamp01(this.#taste.energyVariance - learningRate * 0.4);
        } else {
            this.#taste.transitionIntensity = clamp01(
                this.#taste.transitionIntensity + learningRate * (complex - this.#taste.transitionIntensity),
            );
            this.#taste.originalPreservation = clamp01(this.#taste.originalPreservation - learningRate * complex * 0.3);
            if (latest?.type === "bassdrop") {
                this.#taste.bassTransitionBias = clamp01(this.#taste.bassTransitionBias + learningRate);
            }
            this.#taste.energyVariance = clamp01(this.#taste.energyVariance + learningRate * 0.2);
        }
        this.#taste.samples += evidenceWeight;
        this.#taste.confidence = clamp01(1 - Math.exp(-this.#taste.samples / 12));
        this.#notifySnapshotChanged();
    }

    state(profiles: readonly TrackProfile[] = []): MusicDirectorState {
        const experience = this.#resolveExperience(profiles);
        const age = (this.#now() - this.#startedAt) / 60_000;
        const peakReached = this.#memory.lastEnergyPeakAt !== undefined;
        const phase = phaseFor(age, peakReached);
        const journeyTemplate = projectJourneyTemplate(experience.resolved, phase, age);
        const energies = this.#memory.energyHistory;
        const currentEnergy = energies.at(-1) ?? profiles[0]?.energy ?? experience.vector.targetEnergy;
        let targetEnergy = energyTarget(experience, phase) * 0.55 + journeyTemplate.targetEnergy * 0.45;
        let replay: SessionReplayState | undefined;
        if (this.#replay) {
            const curve = this.#replay.fingerprint.energyCurve;
            const replayIndex = Math.max(0, energies.length - this.#replay.startedAtEnergyIndex);
            const curveIndex = Math.min(curve.length - 1, replayIndex);
            const replayTarget = curve[curveIndex] ?? this.#replay.fingerprint.experienceDNA.targetEnergy;
            targetEnergy = targetEnergy * 0.2 + replayTarget * 0.8;
            replay = {
                active: true,
                progress: curve.length <= 1 ? 1 : clamp01(replayIndex / (curve.length - 1)),
                targetEnergy,
                sourceCreatedAtMs: this.#replay.fingerprint.createdAtMs,
            };
        }
        const fatigue = assessSessionFatigue(this.#memory);
        const recentFamiliarity = profiles.length
            ? profiles.filter((profile) => this.#seenTrackIds.has(profile.trackId)).length / profiles.length
            : 0.5;
        const familiarity = planFamiliarityBalance(
            experience.resolved,
            phase,
            journeyTemplate.targetFamiliarity,
            recentFamiliarity,
        );
        const journey = planSessionJourney({
            phase,
            currentEnergy,
            targetEnergy,
            recentEnergies: energies,
            sessionAgeMinutes: age,
            peakReached,
            userSkips: this.#skips,
            userLikes: this.#likes,
            fatigue,
        });
        return {
            experience,
            session: {
                mood: experience.resolved,
                moodIntensity: experience.intensity,
                currentEnergy,
                targetEnergy,
                sessionAgeMinutes: age,
                recentGenres: [...this.#memory.recentGenres],
                recentKeys: [...this.#memory.recentKeys],
                recentBpms: [...this.#memory.recentBpms],
                peakReached,
                userSkips: this.#skips,
                userLikes: this.#likes,
                phase,
            },
            journey,
            taste: { ...this.#taste },
            fatigue,
            journeyTemplate,
            familiarity,
            ...(this.#override ? { override: this.transitionOverride! } : {}),
            ...(replay ? { replay } : {}),
        };
    }

    /**
     * Rank analyzed radio/autoplay candidates as a route through the current
     * session, not as isolated recommendations. Explicit queue actions stay
     * outside this function and therefore always win.
     */
    rankTrackCandidates(current: TrackProfile, candidates: readonly TrackProfile[]): TrackSelectionScore[] {
        const { experience, session, journey, fatigue, familiarity } = this.state([current, ...candidates]);
        const objectiveWeights = recommendationWeights(experience.resolved, {
            discoveryBudget: familiarity.noveltyTarget,
        });
        const recentGenres = this.#memory.recentGenres.slice(-4);
        const vocalHistory = this.#memory.vocalDensityHistory.slice(-3);
        const recentVocalDensity = vocalHistory.length
            ? vocalHistory.reduce((sum, value) => sum + value, 0) / vocalHistory.length
            : current.vocalness;
        const target = compatibilityTarget(experience, session);
        const routes = scoreCompatibilityRoutes(current, candidates, { target, depth: 3 });
        const routeByFirst = new Map(routes.map((route) => [route.trackIds[1], route]));
        return candidates
            .map((candidate) => {
                const activeOverride =
                    this.#override && overrideMatches(this.#override, current.trackId, candidate.trackId)
                        ? this.#override
                        : null;
                const energyFit = 1 - Math.min(1, Math.abs(candidate.energy - session.targetEnergy));
                const route =
                    routeByFirst.get(candidate.trackId) ??
                    scoreCompatibilityRoutes(current, [candidate], { target, depth: 1 })[0]!;
                const compatibility = route.edges[0] ?? assessTrackCompatibility(current, candidate, target);
                const harmonic = compatibility.key;
                const tempoFit = compatibility.tempo;
                const moodFit =
                    experience.resolved === "chill"
                        ? candidate.acousticness * 0.5 + (1 - candidate.intensity) * 0.5
                        : experience.resolved === "love"
                          ? candidate.valence * 0.35 + candidate.acousticness * 0.25 + (1 - candidate.intensity) * 0.4
                          : experience.resolved === "energy"
                            ? candidate.intensity * 0.7 + candidate.energy * 0.3
                            : candidate.danceability * 0.6 + candidate.energy * 0.4;
                const vocalRelief = recentVocalDensity > 0.62 ? 1 - candidate.vocalness : 0.65;
                const genre = candidate.genres[0]?.genre ?? "unknown";
                const replayGenreFit = this.#replay?.fingerprint.genreDistribution[genre] ?? 0;
                const repeatedGenre = recentGenres.filter((recent) => recent === genre).length;
                const diversity = 1 - Math.min(0.55, repeatedGenre * 0.16);
                const repeatedArtist = candidate.artist
                    ? this.#memory.recentArtists.slice(-8).filter((artist) => artist === candidate.artist).length
                    : 0;
                const artistPenalty = Math.min(1, repeatedArtist / 3) * fatigue.artistRepetition;
                const confidence = candidate.confidence.overall;
                const direction = candidate.energy - current.energy;
                const desiredDirection = session.targetEnergy - current.energy;
                const routeFit = 1 - Math.min(1, Math.abs(direction - desiredDirection));
                const journeyAlignment = scoreJourneyAlignment(journey, candidate.energy, route.futureScore);
                const familiarityEstimate = this.#seenTrackIds.has(candidate.trackId)
                    ? 0.92
                    : candidate.identity?.recordingId || candidate.identity?.isrc || candidate.identity?.fingerprint
                      ? 0.58
                      : 0.32;
                const familiarityFit = scoreFamiliarityCandidate(familiarity, familiarityEstimate, false);
                const candidatePerformance = selectPerformanceStyle(
                    experience,
                    [current, candidate],
                    this.#performanceStyleOverride,
                );
                const versionAdjustment = candidate.identity
                    ? versionPreferenceAdjustment(candidate.identity, { performanceStyle: candidatePerformance.id })
                    : 0;
                const controlledContrast = Math.min(1, Math.abs(direction) / 0.25);
                const overrideDirectionFit =
                    activeOverride?.energyDirection === "up"
                        ? clamp01(0.5 + direction * 2)
                        : activeOverride?.energyDirection === "down"
                          ? clamp01(0.5 - direction * 2)
                          : activeOverride?.energyDirection === "hold"
                            ? 1 - Math.min(1, Math.abs(direction) / 0.15)
                            : 0.5;
                const recommendationObjectives: RecommendationObjectives = {
                    userSatisfaction: moodFit,
                    crowdSatisfaction: 0.5,
                    sessionFit: energyFit,
                    musicalCompatibility: compatibility.total,
                    discovery: 1 - familiarityEstimate,
                    diversity,
                    novelty: controlledContrast,
                    requestPriority: activeOverride ? 1 : 0,
                    fairness: 0.5,
                    trendRelevance: 0.5,
                    localRelevance: replayGenreFit || 0.5,
                    transitionQuality: clamp01((compatibility.total + route.futureScore) / 2),
                };
                const recommendation = rankRecommendationSet(
                    [
                        {
                            id: candidate.trackId,
                            value: candidate,
                            objectives: recommendationObjectives,
                            sequential: {
                                position: 1,
                                sessionLength: Math.max(2, candidates.length + 1),
                                previousCompatibility: compatibility.total,
                                futureRouteFit: route.futureScore,
                                localSequenceFit: routeFit,
                            },
                            hardEligible: true,
                            transitionFeasible: compatibility.total >= 0.2,
                        },
                    ],
                    objectiveWeights,
                )[0]!;
                const hybridRecommendation = hybridRecommendationScore({
                    collaborative: moodFit,
                    content: clamp01((energyFit + harmonic + tempoFit) / 3),
                    knowledgeGraph: replayGenreFit || 0.5,
                    sessionContext: clamp01((energyFit + routeFit + journeyAlignment.score) / 3),
                    socialGraph: 0.5,
                    chartsTrends: 0.5,
                    directorFeatures: clamp01((compatibility.total + route.futureScore + vocalRelief) / 3),
                });
                const score =
                    energyFit * 25 +
                    moodFit * 20 +
                    harmonic * 10 +
                    tempoFit * 8 +
                    routeFit * 10 +
                    vocalRelief * 7 +
                    diversity * 5 +
                    confidence * 4 +
                    replayGenreFit * 6 +
                    compatibility.total * 12 +
                    route.futureScore * 8 +
                    journeyAlignment.score * 8 +
                    familiarityFit.adjustment +
                    versionAdjustment +
                    recommendation.score * 8 +
                    hybridRecommendation.score * 6 +
                    (activeOverride?.energyDirection ? overrideDirectionFit * 10 : 0) +
                    controlledContrast * fatigue.energyFlatness * 8 -
                    artistPenalty * 8 -
                    repeatedGenre * fatigue.genreRepetition * 1.5;
                const reasons = [
                    `energy fit ${round(energyFit)}`,
                    `${experience.resolved} fit ${round(moodFit)}`,
                    `route fit ${round(routeFit)}`,
                    `pair compatibility ${round(compatibility.total)}`,
                    `best route ${route.trackIds.join(" -> ")} (${round(route.score)})`,
                    journeyAlignment.reason,
                    familiarityFit.reason,
                    `multi-objective recommendation ${recommendation.score.toFixed(2)}`,
                    `hybrid recommendation ${hybridRecommendation.score.toFixed(2)}`,
                ];
                if (versionAdjustment)
                    reasons.push(`version preference ${versionAdjustment > 0 ? "+" : ""}${versionAdjustment}`);
                if (harmonic >= 0.7) reasons.push(`harmonic continuity ${round(harmonic)}`);
                if (replayGenreFit >= 0.2) reasons.push(`replay genre fit ${round(replayGenreFit)}`);
                if (recentVocalDensity > 0.62 && candidate.vocalness < 0.45) reasons.push("vocal fatigue relief");
                if (fatigue.energyFlatness >= 0.5 && controlledContrast >= 0.45) {
                    reasons.push(`controlled energy contrast ${round(controlledContrast)}`);
                }
                if (activeOverride?.energyDirection) {
                    reasons.push(
                        `override energy ${activeOverride.energyDirection} fit ${round(overrideDirectionFit)}`,
                    );
                }
                const penalties: string[] = [];
                if (repeatedArtist > 0)
                    penalties.push(`artist fatigue: ${candidate.artist} repeated ${repeatedArtist}×`);
                if (repeatedGenre >= 3) penalties.push(`genre fatigue: ${genre} repeated ${repeatedGenre}×`);
                if (tempoFit < 0.35) penalties.push("large tempo jump");
                if (confidence < 0.35) penalties.push("low analysis confidence");
                if (compatibility.total < 0.42) penalties.push("weak direct compatibility");
                if (route.futureScore < 0.42) penalties.push("route dead end");
                return {
                    profile: candidate,
                    score: round(score),
                    reasons,
                    penalties,
                    compatibility,
                    route,
                    recommendation,
                    hybridRecommendation,
                };
            })
            .sort((a, b) => b.score - a.score || a.profile.trackId.localeCompare(b.profile.trackId));
    }

    planTransition(
        currentTraits: TrackTraits,
        nextTraits: TrackTraits,
        current: TrackProfile,
        next: TrackProfile,
        options: DirectorTransitionOptions,
    ): DirectedTransition {
        this.observeTrack(current, currentTraits.uploader);
        const lookahead = options.lookaheadProfiles ?? [];
        const { experience, session, journey, fatigue, journeyTemplate, familiarity } = this.state([
            current,
            next,
            ...lookahead,
        ]);
        const advancedExperience = advancedDimensionsForSelection(experience);
        const groupRules = groupRulesForPhase(session.phase);
        const fairnessContext =
            experience.resolved === "party" && (session.phase === "peak" || session.phase === "finale")
                ? "party-peak"
                : experience.resolved === "chill"
                  ? "dinner"
                  : "default";
        const crowdGovernance: DirectorCrowdGovernance = {
            fairnessPolicy: selectFairnessPolicy(fairnessContext),
            moodGroundTruth: false,
            physiologicalSignalsRequired: PHYSIOLOGICAL_SIGNAL_POLICY.required,
            physiologicalSignalsDefaultEnabled: PHYSIOLOGICAL_SIGNAL_POLICY.defaultEnabled,
        };
        const contract: SessionContract = {
            experience: experience.requested,
            familiarityTarget: familiarity.familiarityTarget,
            discoveryTarget: familiarity.noveltyTarget,
            groupMode: "fair-share",
            hostPriority: 0.7,
        };
        const popularityInput: PopularityPerception = {
            catalogPopularity: 0.5,
            perceivedFamiliarity: familiarity.familiarityTarget,
        };
        const recommendationGovernance: DirectorRecommendationGovernance = {
            discoveryBudget: planDiscoveryBudget(10, familiarity.noveltyTarget, fatigue.total),
            sessionContract: validateSessionContract(contract),
            primaryObjective: PRODUCT_OPTIMIZATION_OBJECTIVE.primary,
            engagementRole: PRODUCT_OPTIMIZATION_OBJECTIVE.engagementRole,
            chartPrior: chartAsWeakPrior(0.5),
            familiarityPlanning: sessionPlanningPopularity(
                popularityInput,
                experience.resolved === "party"
                    ? "singalong"
                    : familiarity.noveltyTarget > 0.5
                      ? "discovery"
                      : "neutral",
            ),
        };
        const intelligenceBoundary = [
            enforceIntelligenceBoundary("detect-section", "ml-understanding"),
            enforceIntelligenceBoundary("select-track", "deterministic-director"),
            enforceIntelligenceBoundary("select-transition", "deterministic-director"),
            enforceIntelligenceBoundary("render-audio", "deterministic-dsp"),
        ];
        const performanceStyle = selectPerformanceStyle(
            experience,
            [current, next],
            options.performanceStyle ?? this.#performanceStyleOverride,
        );
        const activeOverride =
            this.#override && overrideMatches(this.#override, current.trackId, next.trackId) ? this.#override : null;
        const overrideAudit: TransitionOverrideAudit | null = activeOverride
            ? {
                  overrideId: activeOverride.id,
                  applied: false,
                  scope: activeOverride.scope,
                  appliedFields: [],
                  rejectedFields: [],
                  reasons: [],
              }
            : null;
        const routeTarget = compatibilityTarget(experience, session);
        const compatibilityRoutes = scoreCompatibilityRoutes(current, [next, ...lookahead], {
            target: routeTarget,
            depth: 3,
        });
        const compatibilityRoute =
            compatibilityRoutes.find((route) => route.trackIds[1] === next.trackId) ??
            scoreCompatibilityRoutes(current, [next], { target: routeTarget, depth: 1 })[0]!;
        const compatibility = compatibilityRoute.edges[0] ?? assessTrackCompatibility(current, next, routeTarget);
        const recommendationHardGates = evaluateRecommendationHardGates({
            explicitDislike: false,
            neverPlay: false,
            contentAllowed: true,
            providerAvailable: true,
            sessionAllowed: true,
            duplicate: current.trackId === next.trackId,
            requestOrderValid: true,
            qualitySufficient: next.confidence.overall >= 0.15,
        });
        const sessionContextFit = Math.max(0, 1 - Math.abs(next.energy - session.targetEnergy));
        const recommendationV2: RecommendationV2Audit = {
            architecture: RECOMMENDATION_ARCHITECTURE_V2,
            score: recommendationHardGates.allowed
                ? recommendationScoreV2({
                      personalTaste: Math.max(0.35, compatibility.experience),
                      sessionContext: sessionContextFit,
                      capabilityFit: Math.max(0.2, next.confidence.overall),
                      groupFit: groupRules.consensus,
                      transitionFit: compatibility.total,
                      futureFit: compatibilityRoute.futureScore,
                      memoryAdjustment: 0,
                      fatiguePenalty: 0,
                      overplayPenalty: 0,
                  })
                : 0,
            hardGates: recommendationHardGates,
            transitionFit: compatibility.total,
            futureFit: compatibilityRoute.futureScore,
        };
        const affect = audioOnlyAffect({
            predictedValence: next.valence * 2 - 1,
            predictedArousal: next.energy,
            audioConfidence: next.confidence.overall,
        });
        const uncertainty: RecommendationUncertainty = {
            personalFit: 1 - this.#taste.confidence,
            sessionFit: Math.abs(next.energy - session.targetEnergy),
            crowdFit: 1 - groupRules.consensus,
            moodFit: 1 - (affect.valenceConfidence + affect.arousalConfidence) / 2,
            transitionFit: 1 - compatibility.confidence,
        };
        const riskContext =
            experience.resolved === "party"
                ? "party"
                : experience.resolved === "love"
                  ? "love"
                  : experience.resolved === "chill"
                    ? "background"
                    : "default";
        const researchGovernance: DirectorResearchGovernance = {
            uncertainty,
            riskAdjustedUtility: riskSensitiveScore(recommendationV2.score, uncertainty, riskContext),
            controlMode: "director",
            controlModeLabel: HUMAN_AI_CONTROL_MODES.director.visibleLabel,
            architecture: RESEARCH_BACKED_ARCHITECTURE,
        };
        const transitionExperience = experience.resolved as TransitionExperience;
        const material = !current.beatGrid
            ? current.acousticness >= 0.75
                ? "classical"
                : "beatless"
            : current.bpmConfidence >= 0.72
              ? "locked-electronic"
              : "live-drums";
        const materialIntelligence: DirectorMaterialIntelligence = {
            materialPolicy: materialTransitionPolicy(material),
            noticeabilityTarget: TRANSITION_NOTICEABILITY_TARGETS[transitionExperience],
            arrangementCompetition: arrangementCompetition(
                {
                    density: current.complexity,
                    vocalPresence: current.vocalness,
                    leadPresence: current.intensity,
                    percussionPresence: current.danceability,
                    bassPresence: current.energy,
                },
                {
                    density: next.complexity,
                    vocalPresence: next.vocalness,
                    leadPresence: next.intensity,
                    percussionPresence: next.danceability,
                    bassPresence: next.energy,
                },
            ),
            harmonicStrategy: harmonicTransitionStrategy(
                compatibility.key,
                current.intensity * (1 - current.acousticness * 0.3),
                next.intensity * (1 - next.acousticness * 0.3),
            ),
        };
        const crowdSignalStrength =
            session.userLikes + session.userSkips > 0
                ? Math.max(session.userLikes, session.userSkips) / (session.userLikes + session.userSkips)
                : 0.3;
        const grooveCrowdIntelligence: DirectorGrooveCrowdIntelligence = {
            perceptualState: perceivedMusicState({
                tempo: next.bpm,
                arousal: next.energy,
                groove: next.danceability,
                danceability: next.danceability,
                lowFrequencyDrive: next.intensity,
                rhythmicActivity: next.danceability,
                spectralIntensity: next.intensity,
                density: next.complexity,
                dynamics: Math.min(1, next.dynamicRange / 20),
            }),
            crowdLeadership: decideCrowdLeadership(experience.resolved === "party" ? 0.4 : 0.65, crowdSignalStrength),
            familiarityPleasure: familiarityMediatedPleasure({
                familiarity: familiarity.familiarityTarget,
                arousal: next.energy,
                preferenceFit: recommendationV2.score,
                catalogPopularity: 0.5,
            }),
        };
        const nextExposureCount = this.#memory.transitionHistory.filter(
            (entry) => entry.toTrackId === next.trackId,
        ).length;
        const exposureContext: DirectorExposureContext = {
            exposure: mereExposureInterest(nextExposureCount),
            perceivedRepetition: perceivedRepetition({
                trackRepetition: Math.min(1, nextExposureCount / 4),
                artistRepetition: Math.min(
                    1,
                    this.#memory.recentArtists.filter((artist) => artist === next.artist).length / 4,
                ),
                embeddingSimilarity: compatibility.timbre,
                genreConcentration: compatibility.genre,
                timbreConcentration: compatibility.timbre,
            }),
            contextSpecific: true,
        };
        const performanceExperience = experience.resolved;
        const personalityPreset: TransitionPersonalityPreset =
            performanceExperience === "chill"
                ? "natural"
                : performanceExperience === "love"
                  ? "smooth"
                  : performanceExperience === "energy"
                    ? "club"
                    : "expressive";
        const primaryGenre = next.genres[0]?.genre.toLowerCase() ?? "";
        const genreFamily =
            primaryGenre.includes("house") || primaryGenre.includes("techno")
                ? "house-techno"
                : primaryGenre.includes("hip")
                  ? "hip-hop"
                  : primaryGenre.includes("dnb") || primaryGenre.includes("drum")
                    ? "dnb"
                    : primaryGenre.includes("ambient")
                      ? "ambient"
                      : primaryGenre.includes("rock")
                        ? "rock"
                        : "pop";
        const surprise = distributeSurprise(
            {
                trackNovelty: familiarity.noveltyTarget,
                genreNovelty: 1 - compatibility.genre,
                transitionNovelty: 1 - familiarity.surpriseBudget,
                rhythmicNovelty: Math.abs(next.danceability - current.danceability),
                journeyNovelty: Math.abs(next.energy - session.currentEnergy),
            },
            false,
        );
        const cognitiveLoad = adaptiveCognitiveLoad(
            {
                trackNovelty: familiarity.noveltyTarget,
                transitionSalience: 1 - TRANSITION_PERSONALITIES[personalityPreset].subtlety,
                genreDistance: 1 - compatibility.genre,
                tempoShock: 1 - compatibility.tempo,
                harmonicShock: 1 - compatibility.key,
            },
            performanceExperience,
            session.userSkips / Math.max(1, session.userLikes + session.userSkips),
        );
        const performancePolicy: DirectorPerformancePolicy = {
            loudness: loudnessPolicy(performanceExperience),
            personalityPreset,
            personality: TRANSITION_PERSONALITIES[personalityPreset],
            genrePolicy: genreMixingPolicy(genreFamily),
            stemArtifacts: stemArtifactBudget({
                experience: performanceExperience,
                masking: 1 - materialIntelligence.arrangementCompetition.score,
                vocalExposure: next.vocalness,
            }),
            evidence: fuseTransitionEvidence([
                { source: "audio-model", value: compatibility.total, calibration: compatibility.confidence },
                { source: "genre-policy", value: compatibility.genre, calibration: next.genres[0]?.confidence ?? 0.3 },
                {
                    source: "user-feedback",
                    value: 0.5 + this.#taste.confidence * 0.25,
                    calibration: this.#taste.confidence,
                },
                { source: "listening-test", value: compatibility.total, calibration: compatibility.confidence },
            ]),
            surprise,
            cognitiveLoad,
            candidateDecision: ultimateCandidateDecision({
                songFit: recommendationV2.score,
                momentFit: sessionContextFit,
                journeyFit: compatibilityRoute.score,
                mixFit: compatibility.total,
                experienceFit: compatibility.experience,
            }),
        };
        const sync = syncQualityDecision({
            tempo: compatibility.tempo,
            phase: compatibility.beat,
            bar: compatibility.phrase,
            phrase: compatibility.phrase,
            groove: 1 - Math.abs(current.danceability - next.danceability),
        });
        const bpmDriftMsPerBeat = (Math.abs(current.bpm - next.bpm) / Math.max(1, current.bpm)) * 500;
        const beatgridV2: DirectorBeatgridV2 = {
            sync,
            phase: measurePhaseDrift({ initialErrorMs: 0, finalErrorMs: bpmDriftMsPerBeat, durationSec: 8 }),
            phraseLocked: sync.quality.phrase >= 0.7,
        };
        const clubPhase =
            session.phase === "warmup"
                ? "warmup"
                : session.phase === "peak"
                  ? "peak"
                  : session.phase === "finale"
                    ? "finale"
                    : session.phase === "reset"
                      ? "reset"
                      : session.phase === "build" || session.phase === "rebuild"
                        ? "build"
                        : session.phase === "cooldown"
                          ? "release"
                          : "groove-lock";
        const lowEndCollision = roleCollision(
            "low-end",
            current.energy,
            next.energy,
            (current.complexity + next.complexity) / 2,
        );
        const vocalCollision = roleCollision(
            "vocal",
            current.vocalness,
            next.vocalness,
            (current.complexity + next.complexity) / 2,
        );
        const leadCollision = roleCollision(
            "lead",
            current.intensity,
            next.intensity,
            (current.complexity + next.complexity) / 2,
        );
        const clubV3: DirectorClubV3 = {
            architecture: CLUB_ENGINE_ARCHITECTURE_V3,
            performance: CLUB_PERFORMANCE_ARC[clubPhase],
            tempoPlan: planTempoTransition(current.bpm, next.bpm, {
                sourceStability: current.bpmConfidence,
                targetStability: next.bpmConfidence,
                budget: {
                    maxInstantPercent: 2,
                    maxGradualPercent: 8,
                    maxCentsPitchError: 12,
                    preserveKey: true,
                },
                beatmatchRisk: 1 - compatibility.tempo,
                alternativeRisk: 1 - compatibility.phrase,
            }),
            driftCorrection: predictPhaseDrift([0, beatgridV2.phase.phaseErrorMs], 4),
            vocalCollision,
            leadCollision,
            lowEndCollision,
            momentProtection: protectMoment(
                {
                    start: 0,
                    end: 8,
                    type: "drop",
                    importance: next.drops?.length ? 0.9 : 0.3,
                    overlayTolerance: next.drops?.length ? 0.2 : 0.7,
                },
                CLUB_PERFORMANCE_ARC[clubPhase].intensity,
                false,
            ),
            qualityGuardian: transitionQualityGuardian(
                {
                    clippingRisk: 0,
                    lowEndCollision: lowEndCollision.competition,
                    vocalCollision: vocalCollision.competition,
                    phaseRisk: 1 - sync.quality.phase,
                    stretchRisk: materialIntelligence.harmonicStrategy.risk,
                    stemArtifacts: performancePolicy.stemArtifacts.risk,
                    loudnessJump: Math.min(1, Math.abs(current.loudness - next.loudness) / 12),
                },
                Math.min(current.confidence.beatGrid, next.confidence.beatGrid),
                compatibility.total,
            ),
            taxonomyFamilies: Object.keys(CLUB_TRANSITION_TAXONOMY).length,
        };
        const realtimeReliability: DirectorRealtimeReliability = {
            architecture: REALTIME_ARCHITECTURE,
            route: assessAudioRoute({
                transport: "internal",
                estimatedLatencyMs: 10,
                latencyConfidence: 0.95,
                sampleRate: 48_000,
                channels: 2,
                interactiveSafe: true,
            }),
            qos: chooseDspQuality({ blockDeadlineMs: 20, cpuLoad: 0.35, dspLoad: 0.4, decoderLoad: 0.3, xruns: 0 }),
        };
        const maskingMatrix = buildMaskingMatrix([
            {
                role: "bass",
                spectralEnergy: [current.energy, current.intensity, 0.1],
                onsetDensity: current.danceability,
            },
            { role: "kick", spectralEnergy: [next.energy, next.intensity, 0.1], onsetDensity: next.danceability },
            {
                role: "vocal",
                spectralEnergy: [0.1, current.vocalness, current.vocalness],
                onsetDensity: current.vocalness,
            },
            { role: "lead", spectralEnergy: [0.1, next.intensity, next.intensity], onsetDensity: next.complexity },
        ]);
        const psychoacousticCritic: DirectorPsychoacousticCritic = {
            guardian: psychoacousticGuardian(
                {
                    perceptualLoudness: 1 - Math.min(1, Math.abs(next.loudness + 14) / 20),
                    masking: materialIntelligence.arrangementCompetition.score,
                    clarity: 1 - materialIntelligence.arrangementCompetition.score,
                    foregroundSeparation: 1 - Math.max(vocalCollision.competition, leadCollision.competition),
                    transientDefinition: next.confidence.beatGrid,
                    roughness: Math.abs(current.intensity - next.intensity),
                    spatialSeparation: 1 - lowEndCollision.competition,
                },
                maskingMatrix,
            ),
            rolePairs: maskingMatrix.sourceRoles.length,
        };
        const transitionCriticEvaluation = evaluateTransitionCriticV2({
            clipping: 0,
            dropout: 0,
            stemArtifact: performancePolicy.stemArtifacts.risk,
            stretchArtifact: materialIntelligence.harmonicStrategy.risk,
            phaseError: 1 - sync.quality.phase,
            loudnessDiscontinuity: Math.min(1, Math.abs(current.loudness - next.loudness) / 12),
            masking: materialIntelligence.arrangementCompetition.score,
            foregroundCollision: Math.max(vocalCollision.competition, leadCollision.competition),
            lowEndCompetition: lowEndCollision.competition,
            transientDamage: 1 - Math.min(current.confidence.beatGrid, next.confidence.beatGrid),
            spectralCongestion: materialIntelligence.arrangementCompetition.score,
            beat: compatibility.beat,
            downbeat: sync.quality.bar,
            phrase: compatibility.phrase,
            structure: (current.confidence.phrase + next.confidence.phrase) / 2,
            harmony: compatibility.key,
            payoff: clubV3.qualityGuardian.allowed ? 0.9 : 0.5,
            energyDirection: 1 - Math.abs(next.energy - session.targetEnergy),
            experienceFit: compatibility.experience,
            heuristicNaturalness: compatibility.total,
            learnedNaturalness: clubV3.qualityGuardian.allowed ? 0.9 : 0.5,
            humanEvidence: compatibility.confidence,
        });
        const transitionCriticV2: DirectorTransitionCriticV2 = {
            evaluation: transitionCriticEvaluation,
            disagreement: criticDisagreement(transitionCriticEvaluation),
        };
        const conversationPolicy: DirectorConversationPolicy = {
            boundary: LLM_BOUNDARY,
            application: conversationApplication({
                command: "apply-transition-intent",
                transitionState: "planned",
                isSkip: false,
            }),
            recommendationMode: RECOMMENDATION_MODE_WEIGHTS["best-mix"],
            explanation: usefulExplanation(
                compatibility.total >= 0.7 ? ["smooth-mix"] : ["journey-fit"],
                "normal",
                false,
                0.25,
            ),
        };
        const tasteMode = this.#learningSessionMode === "personal" ? "normal" : this.#learningSessionMode;
        const tastePrivacy: DirectorTastePrivacy = {
            learning: tasteLearningPolicy(tasteMode),
            data: dataPolicy(this.#learningSessionMode === "private" ? "session" : "local", "none"),
            localFirstBoundary: LOCAL_FIRST_DATA_BOUNDARY,
            reliabilityPriority: reliabilityPriority({
                playbackStable: realtimeReliability.route.clubPerformanceSafe,
                fallbackReady: true,
                aiNoveltyGain: compatibilityRoute.futureScore - compatibility.total,
            }),
        };
        const qualityGuardianV3: DirectorQualityGuardianV3 = {
            guardian: evaluateQualityGuardianV3({
                referencesAvailable: true,
                abComparisonAvailable: true,
                renderVerified: true,
                stemConfidence: options.stemsReady ? (current.confidence.stems + next.confidence.stems) / 2 : 0.6,
                stretchRisk: materialIntelligence.harmonicStrategy.risk,
                peakDbfs: -1,
                truePeakDbtp: -1,
                phaseCorrelation: sync.quality.phase * 2 - 1,
                dropoutRate: 0,
                perceptual: {
                    masking: materialIntelligence.arrangementCompetition.score,
                    foregroundClarity: 1 - Math.max(vocalCollision.competition, leadCollision.competition),
                    transientPreservation: Math.min(current.confidence.beatGrid, next.confidence.beatGrid),
                    loudnessContinuity: 1 - Math.min(1, Math.abs(current.loudness - next.loudness) / 12),
                    artifactSalience: performancePolicy.stemArtifacts.risk,
                },
                beatAlignment: compatibility.beat,
                phraseAlignment: compatibility.phrase,
                harmonicCompatibility: compatibility.key,
                structuralContinuity: transitionCriticEvaluation.musicalCoherence,
                tensionFit: clubV3.qualityGuardian.allowed ? 0.9 : 0.5,
                journeyFit: compatibility.experience,
                mixingFit: compatibility.total,
                tasteFit: compatibility.experience,
            }),
            environment: environmentAdaptation(experience.resolved === "party" ? "club" : "headphones"),
            monoSafety: monoFoldDownSafety({
                stereoCorrelation: sync.quality.phase * 2 - 1,
                lowBandSideRatio: lowEndCollision.competition * 0.25,
            }),
            boundary: QUALITY_GUARDIAN_V3_BOUNDARY,
        };
        const confidence = fusedConfidence(current, next);
        const budget = manipulationBudget(current, next, experience, performanceStyle, confidence);
        const maxFadeSec = options.maxFadeSec ?? (experience.resolved === "party" ? 32 : 18);
        const tempoTolerance = options.tempoSync ? 0.08 * performanceStyle.style.tempoFlexibility : 0;
        const candidates = buildTransitionCandidates(currentTraits, nextTraits, options.fadeSec, {
            maxFadeSec,
            tempoTolerance,
            stemsReady: options.stemsReady && activeOverride?.stemUsage !== "forbid",
            ...(options.feedback ? { feedback: options.feedback } : {}),
        });
        const energyDelta = next.energy - current.energy;
        const wantedDelta = session.targetEnergy - current.energy;
        const currentKey = current.beatGrid?.key.camelot;
        const nextKey = next.beatGrid?.key.camelot;
        const keyCompatibility = currentKey && nextKey ? harmonicScore(currentKey, nextKey) : 0.5;
        const rejected: { type: string; reason: string }[] = [];
        const candidateScores: DirectorCandidateScore[] = [];
        const recentSurprises = this.#memory.transitionHistory.map((entry) => classifySurprise(entry.type, false));
        const scored = candidates
            .map((candidate, candidateIndex) => {
                const type = candidate.plan.type;
                const communityPriorities = assessCommunityPriorities({
                    complexity: COMPLEXITY[type],
                    confidence,
                    compatibility: compatibility.total,
                    routeFutureScore: compatibilityRoute.futureScore,
                    beat: candidate.signals.beat,
                    downbeat: candidate.signals.downbeat,
                    phrase: candidate.signals.phrase,
                    structure: candidate.signals.structure,
                    vocals: candidate.signals.vocals,
                    candidateEnergy: next.energy,
                    journey,
                });
                const audit: DirectorCandidateScore = {
                    type,
                    plannerScore: round(candidate.score),
                    signals: candidate.signals,
                    communityPriorities,
                    eligible: false,
                    selected: false,
                    reasons: [...candidate.reasons],
                };
                const novelty = transitionNoveltyBudget(type, this.#memory.transitionHistory);
                const strategyFatigue = assessStrategyFatigue(type, this.#memory.transitionHistory);
                const surpriseBudget = assessSurpriseBudget({
                    event: classifySurprise(
                        type,
                        current.genres[0]?.genre !== next.genres[0]?.genre,
                        current.sections.at(-1)?.type,
                        next.sections[0]?.type,
                    ),
                    phase: session.phase,
                    recentEvents: recentSurprises,
                });
                const effectFatiguePenalty = fatigue.effectFatigue * COMPLEXITY[type];
                audit.noveltyPenalty = novelty.penalty;
                audit.effectFatiguePenalty = round(effectFatiguePenalty);
                audit.strategyFatigue = strategyFatigue;
                audit.surpriseBudget = surpriseBudget;
                audit.reasons.push(...novelty.reasons.map((reason) => `novelty: ${reason}`));
                if (strategyFatigue.penalty > 0) {
                    audit.reasons.push(`strategy fatigue ${strategyFatigue.fatigue.toFixed(2)}`);
                }
                if (!surpriseBudget.allowed) audit.reasons.push(surpriseBudget.reasons.at(-1)!);
                const masking = assessPerceptualMasking({
                    current,
                    next,
                    currentDurationSec: currentTraits.durationMs / 1000,
                    overlapSec: candidate.plan.fadeSec,
                    transitionType: type,
                });
                audit.perceptualMaskingRisk = round(masking.risk);
                audit.perceptualMaskingRecommendation = masking.recommendation;
                audit.reasons.push(...masking.reasons.map((reason) => `masking: ${reason}`));
                const stretch = decideAdaptiveStretch(next, candidate.plan.tempoRatio, {
                    rubberbandAvailable: options.stretcherProfile !== "atempo",
                    highQualityAvailable: options.highQualityStretch ?? false,
                });
                audit.stretchRisk = stretch.risk.total;
                audit.stretchMaterial = stretch.material;
                audit.stretchAllowed = stretch.allowed;
                audit.reasons.push(`stretch: ${stretch.reason}`);
                audit.reasons.push(...communityPriorities.reasons.map((reason) => `priority: ${reason}`));
                candidateScores.push(audit);
                if (confidence < REQUIRED_CONFIDENCE[type]) {
                    const reason = `confidence ${confidence.toFixed(2)} below ${REQUIRED_CONFIDENCE[type].toFixed(2)}`;
                    audit.rejection = reason;
                    rejected.push({ type, reason });
                    return null;
                }
                if (COMPLEXITY[type] > budget.total + 0.12) {
                    const reason = `manipulation budget ${budget.total.toFixed(2)} too low`;
                    audit.rejection = reason;
                    rejected.push({ type, reason });
                    return null;
                }
                if (!communityPriorities.eligible) {
                    const reason = communityPriorities.reasons.at(-1) ?? "community priority policy rejected candidate";
                    audit.rejection = reason;
                    rejected.push({ type, reason });
                    return null;
                }
                if (type === "acapella" && next.vocalness > experience.vector.vocalOverlapTolerance + 0.35) {
                    const reason = "incoming vocal conflict exceeds experience tolerance";
                    audit.rejection = reason;
                    rejected.push({ type, reason });
                    return null;
                }
                if (type === "acapella" && (masking.vocalCollision >= 0.65 || masking.foregroundCollision >= 0.72)) {
                    const reason = `perceptual foreground collision ${masking.foregroundCollision.toFixed(2)}`;
                    audit.rejection = reason;
                    rejected.push({ type, reason });
                    return null;
                }
                const affinity = STYLE_AFFINITY[experience.resolved][type];
                const energyFit = 1 - Math.min(1, Math.abs(energyDelta - wantedDelta));
                const harmonicFit = type === "fade" || type === "cut" ? 0.65 : keyCompatibility;
                const replayTransitionBias = this.#replay?.fingerprint.transitionDistribution[type] ?? 0;
                const bassPreference =
                    type === "bassdrop"
                        ? (this.#taste.bassTransitionBias - 0.5) * 4 +
                          ((this.#replay?.fingerprint.mixPersonality.bassTransitionBias ?? 0.5) - 0.5) * 8
                        : 0;
                // Confidence scales intervention: measured structure/roles can
                // strongly steer the choice; derived-only estimates stay soft.
                const maskingPenalty = masking.risk * (0.45 + masking.confidence * 0.55) * 30;
                const stretchPenalty = stretch.risk.total * 18 + (stretch.allowed ? 0 : 12);
                const noveltyPenalty = novelty.penalty * 22;
                const fatiguePenalty = effectFatiguePenalty * 10;
                const strategyPenalty = strategyFatigue.penalty * 18;
                const surprisePenalty = surpriseBudget.penalty * 16;
                const score =
                    candidate.score * 0.58 +
                    affinity * 24 +
                    energyFit * 12 +
                    harmonicFit * experience.vector.harmonicContinuity * 8 +
                    replayTransitionBias * 5 +
                    bassPreference -
                    maskingPenalty -
                    stretchPenalty -
                    noveltyPenalty -
                    fatiguePenalty -
                    strategyPenalty -
                    surprisePenalty +
                    (communityPriorities.overall - 0.5) * 18 +
                    (activeOverride?.stemUsage === "prefer" && type === "acapella" ? 12 : 0);
                audit.eligible = true;
                audit.directorScore = round(score);
                return {
                    ...candidate,
                    directorScore: score,
                    affinity,
                    energyFit,
                    candidateIndex,
                    masking,
                    communityPriorities,
                };
            })
            .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
            .sort((a, b) => b.directorScore - a.directorScore);

        let safetyFallback = false;
        let plan: TransitionPlan;
        let selected = scored[0];
        if (activeOverride?.transitionType) {
            const forced = scored.find((candidate) => candidate.plan.type === activeOverride.transitionType);
            if (forced) {
                selected = forced;
                overrideAudit?.appliedFields.push("transitionType");
                overrideAudit?.reasons.push(`selected requested ${activeOverride.transitionType} candidate`);
            } else {
                overrideAudit?.rejectedFields.push({
                    field: "transitionType",
                    reason: "requested strategy did not pass confidence and safety eligibility",
                });
            }
        }
        if (selected) candidateScores[selected.candidateIndex]!.selected = true;
        if (!selected) {
            safetyFallback = true;
            const fade = experience.resolved === "chill" || experience.resolved === "love" || confidence < 0.25;
            plan = {
                type: fade ? "fade" : "blend",
                fadeSec: adjustedFade(options.fadeSec, experience, maxFadeSec),
                eqSweep: false,
                tempoRatio: 1,
                reason: `director safety fallback (${experience.resolved}, confidence ${confidence.toFixed(2)})`,
            };
        } else {
            plan = { ...selected.plan };
            plan.fadeSec = adjustedFade(plan.fadeSec, experience, maxFadeSec);
            if (!options.eqSweep || budget.effects < 0.25) plan.eqSweep = false;
            if (budget.timeStretch < Math.abs(plan.tempoRatio - 1) * 5) plan.tempoRatio = 1;
            if (!options.harmonic && plan.reason.includes("harmonic")) plan.type = "blend";
            plan.reason = `${plan.reason}; ${experience.resolved} director ${selected.directorScore.toFixed(1)}`;
        }

        if (activeOverride?.fadeSec !== undefined) {
            if (activeOverride.fadeSec <= maxFadeSec) {
                plan.fadeSec = activeOverride.fadeSec;
                overrideAudit?.appliedFields.push("fadeSec");
            } else {
                overrideAudit?.rejectedFields.push({ field: "fadeSec", reason: `exceeds safe maximum ${maxFadeSec}s` });
            }
        }

        const continuityPolicy = assessAlbumIntegrity(current, next);
        if (continuityPolicy.disableCrossfade && !activeOverride) {
            plan = {
                type: "cut",
                fadeSec: 0.05,
                eqSweep: false,
                tempoRatio: 1,
                reason: `album integrity: ${continuityPolicy.reason}`,
            };
            for (const candidate of candidateScores) candidate.selected = false;
            const albumCut = candidateScores.find((candidate) => candidate.type === "cut");
            if (albumCut) {
                albumCut.selected = true;
                albumCut.eligible = true;
                delete albumCut.rejection;
                albumCut.reasons.push("album integrity selected a zero-overlap boundary");
            }
        }

        const pairKeyConfidence = Math.min(current.keyConfidence, next.keyConfidence);
        const keyConflict =
            current.beatGrid?.analysisConfidence?.key.conflicted === true ||
            next.beatGrid?.analysisConfidence?.key.conflicted === true;
        const harmonicLimit = harmonicOverlapLimit(pairKeyConfidence, keyConflict);
        if (HARMONIC_OVERLAP.has(plan.type) && plan.fadeSec > harmonicLimit) {
            plan.fadeSec = harmonicLimit;
            plan.reason = `${plan.reason}; harmonic overlap capped by fused key confidence ${pairKeyConfidence.toFixed(2)}`;
        }

        const noveltyBudget = transitionNoveltyBudget(plan.type, this.#memory.transitionHistory);
        const strategyFatigue = assessStrategyFatigue(plan.type, this.#memory.transitionHistory);
        const surpriseBudget = assessSurpriseBudget({
            event: classifySurprise(
                plan.type,
                current.genres[0]?.genre !== next.genres[0]?.genre,
                current.sections.at(-1)?.type,
                next.sections[0]?.type,
            ),
            phase: session.phase,
            recentEvents: this.#memory.transitionHistory.map((entry) => classifySurprise(entry.type, false)),
        });

        const perceptualMasking = assessPerceptualMasking({
            current,
            next,
            currentDurationSec: currentTraits.durationMs / 1000,
            overlapSec: plan.fadeSec,
            transitionType: plan.type,
        });
        const stretchDecision = decideAdaptiveStretch(next, plan.tempoRatio, {
            rubberbandAvailable: options.stretcherProfile !== "atempo",
            highQualityAvailable: options.highQualityStretch ?? false,
        });
        plan.tempoRatio = stretchDecision.appliedRatio;
        if (stretchDecision.appliedRatio !== 1) plan.stretch = stretchDecision;
        else delete plan.stretch;
        if (!stretchDecision.allowed) plan.reason = `${plan.reason}; tempo sync disabled (${stretchDecision.reason})`;

        const beatCritical = !new Set<TransitionType>(["fade", "echo"]).has(plan.type);
        const unifiedQuality = assessUnifiedQuality({
            clippingRisk: 0.05,
            loudnessDiscontinuity: clamp01(Math.abs(current.loudness - next.loudness) / 18),
            spectralCollision: perceptualMasking.bassCompetition,
            vocalCollision: perceptualMasking.vocalCollision,
            phaseRisk:
                plan.type === "acapella"
                    ? clamp01(1 - Math.min(current.confidence.stems, next.confidence.stems))
                    : 0.08,
            stretchArtifacts: stretchDecision.risk.total,
            stemArtifacts: plan.type === "acapella" ? clamp01(1 - current.confidence.stems) : 0,
            rhythmicMismatch: beatCritical
                ? clamp01(1 - Math.min(current.confidence.beatGrid, next.confidence.beatGrid))
                : 0.05,
        });
        const policyDecision = decideDirectorPolicy({
            requestedPlan: plan,
            experience: experience.resolved,
            capabilities: this.#capabilities,
            quality: unifiedQuality,
            queueAllows: true,
            songIntegrityPreserved: !continuityPolicy.disableCrossfade || plan.type === "cut",
        });
        plan = policyDecision.plan;

        const allowedOutgoing = activeOverride
            ? allowedOverrideRegions(current, "current", "out", activeOverride)
            : current.mixOutRegions;
        const allowedIncoming = activeOverride
            ? allowedOverrideRegions(next, "next", "in", activeOverride)
            : next.mixInRegions;
        const hasRegionRules =
            !!activeOverride &&
            (activeOverride.neverMixRegions.length > 0 || activeOverride.preserveSection !== undefined);
        const regionRulesUsable = !hasRegionRules || (!!allowedOutgoing?.length && !!allowedIncoming?.length);
        if (hasRegionRules) {
            if (regionRulesUsable) {
                overrideAudit?.appliedFields.push("regions");
            } else {
                overrideAudit?.rejectedFields.push({
                    field: "regions",
                    reason: "rules remove every analyzed mix region; automatic safe regions retained",
                });
            }
        }
        const regionSelection = selectTransitionRegions({
            current: regionRulesUsable && allowedOutgoing ? { ...current, mixOutRegions: allowedOutgoing } : current,
            next: regionRulesUsable && allowedIncoming ? { ...next, mixInRegions: allowedIncoming } : next,
            transitionType: plan.type,
            fadeSec: plan.fadeSec,
            preserveStructure: performanceStyle.style.structurePreservation,
            vocalOverlapTolerance: experience.vector.vocalOverlapTolerance,
            targetEnergyDelta: wantedDelta,
        });
        if (regionSelection) {
            plan.regions = regionSelection;
            plan.reason = `${plan.reason}; regions ${regionSelection.outgoing.kind}->${regionSelection.incoming.kind}`;
        } else {
            delete plan.regions;
        }

        // Shadow mode: compare the production policy with the original planner
        // ranking. It is logged only and can never alter the audible plan.
        const shadowCandidate = [...scored].sort((a, b) => b.score - a.score)[0];
        const shadowType = shadowCandidate?.plan.type ?? plan.type;
        const shadow: DirectorShadowDecision = {
            policy: "planner-score-baseline-v1",
            selectedType: shadowType,
            selectedScore: round(shadowCandidate?.score ?? 0),
            differsFromProduction: shadowType !== plan.type,
        };

        const preRollSec = HARD_ENTRY.has(plan.type) ? 0.02 : B_PRE_ROLL_SEC * plan.tempoRatio;
        const validMixOutOverride =
            activeOverride?.mixOutPointSec !== undefined &&
            activeOverride.mixOutPointSec < currentTraits.durationMs / 1000;
        const validMixInOverride =
            activeOverride?.mixInPointSec !== undefined && activeOverride.mixInPointSec < nextTraits.durationMs / 1000;
        const cueOutgoingRegion = validMixOutOverride
            ? {
                  start: activeOverride!.mixOutPointSec!,
                  end: activeOverride!.mixOutPointSec! + plan.fadeSec * (options.outgoingTempoRatio || 1),
              }
            : regionSelection?.outgoing;
        const cueIncomingRegion = validMixInOverride
            ? {
                  start: activeOverride!.mixInPointSec!,
                  end: activeOverride!.mixInPointSec! + Math.max(1, plan.fadeSec),
              }
            : regionSelection?.incoming;
        let cue = chooseTransitionCue({
            currentGrid: currentTraits.grid,
            nextGrid: nextTraits.grid,
            currentDurationSec: currentTraits.durationMs / 1000,
            transitionType: plan.type,
            fadeSec: plan.fadeSec,
            outgoingTempoRatio: options.outgoingTempoRatio,
            preRollSec,
            ...(cueOutgoingRegion && cueIncomingRegion
                ? {
                      outgoingRegion: cueOutgoingRegion,
                      incomingRegion: cueIncomingRegion,
                  }
                : {}),
            ...(activeOverride?.alignment && activeOverride.alignment !== "exact"
                ? { alignment: activeOverride.alignment }
                : {}),
        });
        if (activeOverride?.mixOutPointSec !== undefined) {
            if (validMixOutOverride) {
                cue = {
                    ...cue,
                    aStartSec: round(activeOverride.mixOutPointSec, 3),
                    aStartPlaySec: round(activeOverride.mixOutPointSec / (options.outgoingTempoRatio || 1), 3),
                    reason: `${cue.reason}; exact overridden mix-out`,
                };
                overrideAudit?.appliedFields.push("mixOutPointSec");
            } else {
                overrideAudit?.rejectedFields.push({ field: "mixOutPointSec", reason: "outside current track" });
            }
        }
        if (activeOverride?.mixInPointSec !== undefined) {
            if (validMixInOverride) {
                cue = {
                    ...cue,
                    bDropSec: round(activeOverride.mixInPointSec, 3),
                    bStartSec: round(Math.max(0, activeOverride.mixInPointSec - preRollSec), 3),
                    reason: `${cue.reason}; exact overridden mix-in`,
                };
                overrideAudit?.appliedFields.push("mixInPointSec");
            } else {
                overrideAudit?.rejectedFields.push({ field: "mixInPointSec", reason: "outside next track" });
            }
        }
        if (continuityPolicy.disableCrossfade && !activeOverride) {
            const boundary = Math.max(0, currentTraits.durationMs / 1000 - plan.fadeSec);
            cue = {
                ...cue,
                aStartSec: round(boundary, 3),
                aStartPlaySec: round(boundary / (options.outgoingTempoRatio || 1), 3),
                bStartSec: 0,
                bDropSec: 0,
                reason: `${cue.reason}; original album boundary preserved`,
            };
        }
        if (activeOverride?.alignment) overrideAudit?.appliedFields.push("alignment");
        if (activeOverride?.stemUsage) overrideAudit?.appliedFields.push("stemUsage");
        if (activeOverride?.energyDirection) overrideAudit?.appliedFields.push("energyDirection");
        if (overrideAudit) overrideAudit.applied = overrideAudit.appliedFields.length > 0;
        let musicalIntelligence = buildJourneyIntelligence(current, next, cue.aStartSec, cue.bDropSec);
        const tension = {
            sections: analyzeMusicalTension(current),
            cut: assessPayoffCut(current, cue.aStartSec),
        };
        if (
            (musicalIntelligence.current.structuralCut.blocked || tension.cut.blocked) &&
            performanceStyle.style.structurePreservation >= 0.6 &&
            !validMixOutOverride &&
            !continuityPolicy.disableCrossfade
        ) {
            const payoffEnd = Math.max(
                cue.aStartSec,
                tension.cut.payoffAtSec ?? cue.aStartSec,
                ...musicalIntelligence.current.structuralCut.unresolved.map(
                    (dependency) => current.sections[dependency.targetSection]?.end ?? cue.aStartSec,
                ),
            );
            if (payoffEnd + plan.fadeSec <= currentTraits.durationMs / 1000) {
                cue = {
                    ...cue,
                    aStartSec: round(payoffEnd, 3),
                    aStartPlaySec: round(payoffEnd / (options.outgoingTempoRatio || 1), 3),
                    reason: `${cue.reason}; deferred until anticipation/structural payoff`,
                };
                musicalIntelligence = buildJourneyIntelligence(current, next, cue.aStartSec, cue.bDropSec);
            }
        }
        const loopability = selectSafeLoop(current, cue.aStartSec);
        const emergencyContinuity = planEmergencyContinuity({
            current,
            nextReady: true,
            currentPositionSec: options.currentPositionSec ?? 0,
            fallbackTrackId: lookahead[0]?.trackId ?? null,
        });
        const backtiming = this.#timedMoment
            ? planBacktiming(
                  this.#now(),
                  this.#timedMoment,
                  [current, next, ...lookahead].map((profile, index) => ({
                      trackId: profile.trackId,
                      durationSec:
                          profile.durationSec ?? Math.max(1, ...profile.sections.map((section) => section.end), 180),
                      transitionOverlapSec: index === 0 ? plan.fadeSec : Math.min(plan.fadeSec, 8),
                  })),
              )
            : null;
        const prioritySeed =
            selected?.communityPriorities ??
            assessCommunityPriorities({
                complexity: COMPLEXITY[plan.type],
                confidence,
                compatibility: compatibility.total,
                routeFutureScore: compatibilityRoute.futureScore,
                beat: 50,
                downbeat: 50,
                phrase: 50,
                structure: 50,
                vocals: 50,
                candidateEnergy: next.energy,
                journey,
            });
        const communityPriorities = finalizeCommunityPriorities(prioritySeed, cue, regionSelection?.confidence);
        const pairBeatConfidence = Math.min(current.confidence.beatGrid, next.confidence.beatGrid);
        const pairStructureConfidence = Math.min(current.confidence.structure, next.confidence.structure);
        const pairVocalConfidence = Math.min(current.confidence.vocals, next.confidence.vocals);
        const architecture = assessArchitectureStatus({
            experience: {
                selection: experience.confidence,
                blend: Object.values(experience.weights).filter((weight) => weight > 0.05).length > 1 ? 1 : 0.75,
            },
            context: {
                activity: session.sessionAgeMinutes > 0 ? 0.5 : 0.25,
                session: true,
                crowd: false,
                "user-intent": experience.requested === "auto" ? experience.confidence : true,
            },
            "music-director": {
                journey: journey.confidence,
                memory: Math.min(1, this.#memory.energyHistory.length / 4),
                moments: communityPriorities.fixedTimestampFallback ? 0.4 : communityPriorities.musicalMoment,
                diversity: 1 - fatigue.total * 0.5,
            },
            "queue-route-planner": {
                "compatibility-graph": compatibility.total,
                bridges: compatibilityRoute.trackIds.length > 2 ? compatibilityRoute.futureScore : 0.5,
                "energy-curve": journey.confidence,
                lookahead: Math.min(1, lookahead.length / 2),
            },
            "musical-intelligence": {
                beat: pairBeatConfidence,
                key: pairKeyConfidence,
                structure: pairStructureConfidence,
                vocals: pairVocalConfidence,
                timbre: confidence,
            },
            "transition-intelligence": {
                candidates: Math.min(1, candidates.length / 4),
                scoring: selected ? 1 : 0.4,
                reasoning: true,
                simulation: 0.75,
            },
            "rescue-engine": { validation: 0.5, fallback: true, deadline: false },
            "audio-engine": {
                mixer: true,
                stems: options.stemsReady ? 1 : 0.25,
                "eq-fx": true,
                stretch: options.tempoSync ? 1 : 0.5,
                pitch: budget.pitchShift >= 0.25 ? 0.5 : 0.25,
            },
            "quality-guardian": {
                "loudness-peak": 0.5,
                phase: 0.5,
                artifacts: 1 - perceptualMasking.risk,
                "stem-quality": options.stemsReady ? current.confidence.stems : 0.25,
            },
            "compute-scheduler": {
                cache: true,
                lookahead: lookahead.length ? 1 : 0.25,
                cpu: true,
                gpu: options.highQualityStretch ? 1 : 0.25,
                battery: 0.5,
            },
        });
        const research = researchProvenanceForDecision({
            transitionType: plan.type,
            tempoRatio: plan.tempoRatio,
            usesStems: plan.type === "acapella",
            harmonicOverlap: HARMONIC_OVERLAP.has(plan.type) && keyCompatibility >= 0.5,
            fixedTimestampFallback: communityPriorities.fixedTimestampFallback,
            hasStructuredRegions: regionSelection !== null,
            overrideApplied: overrideAudit?.applied ?? false,
            rescueAvailable: true,
            journeyPlanned: journey.horizon.length > 1,
        });
        const principles = assessResearchPrinciples({
            complexity: COMPLEXITY[plan.type],
            confidence,
            musicalBoundary: !communityPriorities.fixedTimestampFallback,
            genreContribution: selected?.signals.genreContribution ?? 0,
            hasStructuredRegions: regionSelection !== null,
            usesStems: plan.type === "acapella",
            stemQualityScore: currentTraits.stemQuality?.score ?? null,
            preplanned: true,
            validation: "estimated",
            rescueAvailable: true,
            journeyHorizon: journey.horizon.length,
            overrideStatus: !activeOverride
                ? "inactive"
                : overrideAudit?.applied
                  ? "applied"
                  : overrideAudit?.rejectedFields.length
                    ? "safety-rejected"
                    : "ignored",
            subjectiveEvaluationAvailable: true,
            humanEvidence: 0,
        });
        const durationBeats = current.bpm > 0 ? Math.round((plan.fadeSec * current.bpm) / 60) : undefined;
        const roundedBudget: ManipulationBudget = {
            total: round(budget.total),
            timeStretch: round(budget.timeStretch),
            pitchShift: round(budget.pitchShift),
            looping: round(budget.looping),
            stemMixing: round(budget.stemMixing),
            structureEditing: round(budget.structureEditing),
            effects: round(budget.effects),
        };
        const intent: TransitionIntent = {
            style: planStyle(plan.type, plan.tempoRatio),
            intensity: performanceStyle.style.transitionIntensity,
            ...(durationBeats ? { durationBeats } : {}),
            preserveTempo: plan.tempoRatio === 1,
            preserveVocals: experience.vector.vocalOverlapTolerance < 0.2,
            preserveStructure: performanceStyle.style.structurePreservation >= 0.6,
            targetEnergyDelta: round(wantedDelta),
            confidence: round(confidence),
        };
        const progressivePlan = buildProgressiveTransitionPlan({
            selectedPlan: plan,
            secondsUntilCue: cue.aStartPlaySec - (options.currentPositionSec ?? 0),
            beatPhraseReady: pairBeatConfidence >= 0.5 && pairStructureConfidence >= 0.45,
            stemsReady: options.stemsReady,
            previewValidated: false,
        });
        const reasons = [
            experience.reason,
            performanceStyle.reason,
            `session ${session.phase}: energy ${session.currentEnergy.toFixed(2)} → ${session.targetEnergy.toFixed(2)}`,
            `session journey ${journey.intent}/${journey.direction}: next ${journey.nextTargetEnergy.toFixed(2)}, horizon ${journey.horizon.map((step) => step.targetEnergy.toFixed(2)).join(" → ")}`,
            `journey template ${journeyTemplate.templateId}/${journeyTemplate.label}: energy ${journeyTemplate.targetEnergy.toFixed(2)}, tension ${journeyTemplate.targetTension.toFixed(2)}, familiarity ${journeyTemplate.targetFamiliarity.toFixed(2)}`,
            familiarity.reason,
            `community priorities ${communityPriorities.overall.toFixed(2)}: ${communityPriorities.reasons.at(-1)}`,
            `architecture ${architecture.status} ${architecture.overall.toFixed(2)} (${architecture.readyLayers}/10 layers ready)`,
            `research provenance ${research.sourceIds.join(", ")}`,
            `research principles ${principles.score.toFixed(2)} (${principles.passed} pass, ${principles.warnings} warn, ${principles.failed} fail)`,
            `anytime plan ${progressivePlan.state}/${progressivePlan.activeEvidence}, ${progressivePlan.horizon.zone} horizon`,
            `musical timeline ${musicalIntelligence.current.transitionTime ? `bar ${musicalIntelligence.current.transitionTime.bar} beat ${musicalIntelligence.current.transitionTime.beat}` : "unavailable"}; dynamic tempo ${musicalIntelligence.current.timeline?.variableTempo ? "yes" : "no"}`,
            `structural cut risk ${musicalIntelligence.current.structuralCut.penalty.toFixed(2)}: ${musicalIntelligence.current.structuralCut.reasons.join(", ")}`,
            `anticipation ${tension.cut.anticipation.toFixed(2)}: ${tension.cut.reason}`,
            loopability
                ? `loopability ${loopability.total.toFixed(2)} at ${loopability.start.toFixed(1)}-${loopability.end.toFixed(1)}s`
                : "no safe emergency loop",
            `surprise ${surpriseBudget.event}: ${(surpriseBudget.remaining * 100).toFixed(0)}% remaining`,
            `strategy fatigue ${strategyFatigue.strategyId}: ${(strategyFatigue.fatigue * 100).toFixed(0)}%`,
            `album integrity: ${continuityPolicy.reason}`,
            `policy ${policyDecision.approved ? "approved" : "rescued"}: ${policyDecision.appliedPriorities.join(" > ")}`,
            `unified quality ${unifiedQuality.approved ? "approved" : "rejected"} risk ${unifiedQuality.totalRisk.toFixed(2)}${unifiedQuality.reasons.length ? ` (${unifiedQuality.reasons.join(", ")})` : ""}`,
            `intelligence boundary ${intelligenceBoundary.every((item) => item.allowed) ? "valid" : "violated"}: ML understand > deterministic policy > deterministic DSP`,
            `learning session ${this.#learningSessionMode}`,
            `group phase rules: consensus ${groupRules.consensus.toFixed(2)}, familiarity ${groupRules.familiarity.toFixed(2)}, minority ${groupRules.minorityOpportunity.toFixed(2)}`,
            backtiming
                ? `backtiming ${backtiming.request.id}: ${backtiming.status}, error ${backtiming.errorSec.toFixed(1)}s`
                : "backtiming inactive",
            `pair confidence ${confidence.toFixed(2)}, manipulation budget ${budget.total.toFixed(2)}`,
            `energy delta ${energyDelta >= 0 ? "+" : ""}${energyDelta.toFixed(2)}, key compatibility ${keyCompatibility.toFixed(2)}`,
            `fused key confidence ${pairKeyConfidence.toFixed(2)}${keyConflict ? " (analyzer conflict)" : ""}`,
            `perceptual masking ${perceptualMasking.risk.toFixed(2)} (${perceptualMasking.recommendation}): ${perceptualMasking.reasons.join(", ")}`,
            `adaptive stretch ${stretchDecision.appliedRatio.toFixed(3)} (${stretchDecision.material}, risk ${stretchDecision.risk.total.toFixed(2)}): ${stretchDecision.reason}`,
            regionSelection
                ? `mix regions ${regionSelection.reason}, quality ${regionSelection.score.toFixed(1)}, confidence ${regionSelection.confidence.toFixed(2)}`
                : "mix regions unavailable; cue planner fallback",
            `track compatibility ${compatibility.total.toFixed(2)} (beat ${compatibility.beat.toFixed(2)}, key ${compatibility.key.toFixed(2)}, phrase ${compatibility.phrase.toFixed(2)}, vocals ${compatibility.vocals.toFixed(2)})`,
            `tempo relationship ${compatibility.tempoRelation} (plausibility ${compatibility.tempoPlausibility.toFixed(2)})`,
            `compatibility route ${compatibilityRoute.trackIds.join(" -> ")} (${compatibilityRoute.score.toFixed(2)}, future ${compatibilityRoute.futureScore.toFixed(2)})`,
            `session fatigue ${fatigue.total.toFixed(2)} (${fatigue.dominant})${fatigue.recommendations.length ? `: ${fatigue.recommendations.join(", ")}` : ""}`,
            `transition novelty ${plan.type}: ${(noveltyBudget.remaining * 100).toFixed(0)}% remaining${noveltyBudget.reasons.length ? ` (${noveltyBudget.reasons.join(", ")})` : ""}`,
            overrideAudit
                ? `human override ${overrideAudit.overrideId}: ${overrideAudit.appliedFields.join(", ") || "no fields applied"}${overrideAudit.rejectedFields.length ? `; rejected ${overrideAudit.rejectedFields.map((field) => field.field).join(", ")}` : ""}`
                : "human override inactive",
        ];
        const whyThis = buildWhyThis({
            trackReasons: [
                `energy target ${session.targetEnergy.toFixed(2)}`,
                `compatibility ${compatibility.total.toFixed(2)}`,
                `route ${compatibilityRoute.trackIds.join(" -> ")}`,
                familiarity.reason,
            ],
            transitionReasons: reasons,
            rejectedReasons: rejected.map((item) => `${item.type}: ${item.reason}`),
        });
        const vision = buildUltimateVisionDecision({
            nextTrackId: next.trackId,
            plan,
            cueAtSec: cue.aStartSec,
            intent,
            budget: roundedBudget,
            performanceStyle,
            progressivePlan,
            intelligence: musicalIntelligence,
            journey,
            route: compatibilityRoute,
            reasons: reasons.slice(0, 8),
        });
        const evaluationReliabilityV2: DirectorEvaluationReliabilityV2 = {
            slos: reliabilitySloStatus({
                dropoutRate: 0,
                catastrophicGridFailureRate:
                    1 - Math.min(current.confidence.beatGrid, next.confidence.beatGrid) < 0.005 ? 0 : 0.005,
                fallbackSuccessRate: realtimeReliability.route.clubPerformanceSafe ? 1 : 0.99,
                commitMissRate: 0,
            }),
            naturalnessResearch: researchConfidence("transition-naturalness"),
            shadowCritic: shadowEvaluation(
                qualityGuardianV3.guardian.verdict,
                transitionCriticV2.disagreement.requiresRepair ? "repair" : "approve",
            ),
        };
        const semanticIntelligence: DirectorSemanticIntelligence = {
            fit: contextualFit({
                audioFit: compatibility.total,
                semanticFit: compatibility.experience,
                semanticImportance: experience.resolved === "love" ? 0.6 : 0.35,
            }),
            culturalConfidence: culturalGeneralization(
                Math.min(current.confidence.overall, next.confidence.overall),
                current.genres.some((genre) => genre.genre !== "unknown") &&
                    next.genres.some((genre) => genre.genre !== "unknown"),
            ),
            discovery: semanticDiscoveryBudget({
                curiosity: noveltyBudget.remaining,
                noveltyTolerance: experience.vector.dynamicVariation,
                currentDiscoveryFatigue: fatigue.total,
            }),
            journey: semanticJourney([
                {
                    position: 0,
                    energy: current.energy,
                    emotion: experience.resolved,
                    semantic: current.genres[0]?.genre ?? "unknown",
                },
                {
                    position: 1,
                    energy: next.energy,
                    emotion: experience.resolved,
                    semantic: next.genres[0]?.genre ?? "unknown",
                },
            ]),
        };
        const safeListening: DirectorSafeListening = {
            hearing: hearingAccessibility({
                mode: "standard",
                highFrequencyPreference: 0.5,
                vocalClarityPreference: 0.5,
                explicitlySetByUser: false,
            }),
            loudness: safeLoudnessGuard({ duration: plan.fadeSec, confidence: 0 }),
            energy: energyStrategy(Math.max(0, wantedDelta)),
            presentation: accessiblePresentation(next.energy, {
                reducedMotion: false,
                highContrast: false,
                screenReaderLabels: true,
                keyboardControl: true,
                hapticAlternatives: false,
                flashingVisuals: false,
            }),
        };
        const distributedRecovery: DirectorDistributedRecovery = {
            futureEvent: scheduleFutureEvent(
                {
                    event: "UPCOMING_TRANSITION",
                    sessionSample: Math.round(cue.aStartPlaySec * 48_000),
                    sessionTime: cue.aStartPlaySec,
                    confidence,
                },
                options.currentPositionSec ?? 0,
            ),
            clock: clockSynchronization(
                { sessionEpoch: 0n, offsetNs: 0, driftPpm: 0, jitterNs: 0, confidence: 0.99 },
                "visualizer",
            ),
            confidence: confidenceSeparation(sync.quality.phase, confidence),
            recovery: unifiedRecovery({
                domain: "transition",
                localRepairAvailable: qualityGuardianV3.guardian.verdict === "repair",
                capability: plan.type,
            }),
        };
        const rightsCapabilities: TrackRightsCapabilities = {
            playback: true,
            crossfade: true,
            beatmatch: true,
            eqMix: true,
            stems: options.stemsReady,
            remix: options.stemsReady,
            export: false,
        };
        const rightsPlanning: DirectorRightsPlanning = {
            capabilities: rightsCapabilities,
            transition: capabilityAwareTransition(rightsCapabilities, rightsCapabilities, [
                "stems",
                "eqMix",
                "beatmatch",
            ]),
        };
        const temporalAgent: DirectorTemporalAgent = {
            graph: temporalIntentGraph([
                {
                    startCondition: { kind: "now" },
                    changes: { energy: session.targetEnergy, familiarity: familiarity.familiarityTarget },
                    sourceText: "active session contract",
                },
            ]),
            retry: reflectiveRetry(
                [
                    { id: "rights", value: "required", importance: 1, relaxability: 0, kind: "rights" },
                    { id: "exact-bpm", value: next.bpm, importance: 0.35, relaxability: 0.8, kind: "bpm" },
                    {
                        id: "bridge",
                        value: compatibilityRoute.futureScore,
                        importance: 0.85,
                        relaxability: 0.15,
                        kind: "bridge",
                    },
                ],
                compatibility.total < 0.65 ? ["candidate-quality"] : [],
            ),
            evidence: fuseMusicEvidence([
                { value: cue.aStartSec, source: "cue-planner", confidence, precisionClass: "sample" },
                {
                    value: cue.aStartSec,
                    source: "director-semantics",
                    confidence: compatibility.experience,
                    precisionClass: "semantic",
                },
            ]),
        };
        const stemQuality = {
            separation: options.stemsReady ? current.confidence.stems : 0.5,
            perceptualQuality: 1 - performancePolicy.stemArtifacts.risk,
            leakage: performancePolicy.stemArtifacts.risk,
            transientIntegrity: Math.min(current.confidence.beatGrid, next.confidence.beatGrid),
            tonalIntegrity: compatibility.key,
            temporalStability: compatibility.phrase,
        };
        const stemQualityValue = stemQualityScore(stemQuality);
        const stemSequential: DirectorStemSequential = {
            quality: stemQualityValue,
            restoration: transitionLocalRestoration({
                bars: Math.max(8, Math.round((plan.fadeSec * current.bpm) / 240)),
                stemQuality: stemQualityValue,
                hqMode: options.highQualityStretch ?? false,
                computeAvailable: realtimeReliability.qos.level !== "safe-playback",
                artisticProductionRisk: performancePolicy.stemArtifacts.risk,
            }),
            construction: constructSequentialTransition(
                rolePreset(plan.type === "bassdrop" ? "bass-swap" : "eq-blend"),
                (roles) =>
                    Math.max(0, compatibility.total - roles.length * performancePolicy.stemArtifacts.risk * 0.05),
            ),
        };
        const provenanceSignal: DirectorProvenanceSignal = {
            provenance: provenanceRecommendation(
                { origin: "unknown", confidence: 0, trustedProviderData: false },
                "allow",
            ),
            signalPath: signalPath(experience.resolved, true),
            evaluation: evaluationEnsemble({
                objective: qualityGuardianV3.guardian.technical,
                specialist: transitionCriticV2.evaluation.musicalCoherence,
                llmJudge: semanticIntelligence.fit.combined,
                humanPanel: 0.5,
                realBehavior: familiarity.familiarityTarget,
            }),
        };
        const momentOffset = Math.max(8, (next.durationSec ?? 180) * 0.25);
        const desiredMomentTime = cue.aStartPlaySec + plan.fadeSec + momentOffset;
        const momentCompute: DirectorMomentCompute = {
            recommendation: momentFirstRecommendation([
                {
                    trackId: next.trackId,
                    trackFit: compatibility.total,
                    momentFit: compatibility.experience,
                    timeToMomentFit: compatibility.phrase,
                    transitionToMomentFit: qualityGuardianV3.guardian.musical,
                },
            ]),
            target: backtimeTargetMoment(
                {
                    track: next.trackId,
                    moment: next.drops?.length ? "drop" : "chorus",
                    desiredSessionTime: desiredMomentTime,
                    momentTimeInTrack: momentOffset,
                },
                plan.fadeSec,
                0,
            ),
            compute: computeBudgetForRisk(Math.max(transitionCriticV2.disagreement.spread, 1 - compatibility.total)),
            explanation: confidenceNativeExplanation({
                transition: confidence,
                beatgrid: Math.min(current.confidence.beatGrid, next.confidence.beatGrid),
                stemQuality: stemQualityValue,
                fallback: rightsPlanning.transition.strategy,
                reason: stemQualityValue < 0.7 ? "stem quality is uncertain" : "it fits the validated capabilities",
            }),
        };
        const artistEcosystem: DirectorArtistEcosystem = {
            relationshipOpportunity: artistOpportunity(
                {
                    stage: "discovered",
                    affinity: familiarity.familiarityTarget,
                    familiarity: familiarity.familiarityTarget,
                    intentionalListening: 0.3,
                    repeatBehavior: 0.2,
                    catalogDepth: 0.2,
                    confidence: compatibility.confidence,
                },
                compatibility.experience,
                fatigue.artistRepetition,
            ),
            discoveryQuality: artistDiscoveryQuality({
                userFit: compatibility.experience,
                sessionFit: 1 - Math.abs(next.energy - session.targetEnergy),
                bridgePotential: compatibilityRoute.futureScore,
                obscureOnly: false,
            }),
            exposureFairness: opportunityNormalizedFairness({
                impressions: 1,
                plays: 0,
                qualifiedImpressions: 1,
                exposureShare: 1,
                catalogShare: 0,
                opportunityShare: 1,
            }),
        };
        const artistAnalytics: DirectorArtistAnalytics = {
            nonSelection: aggregateNonSelection(
                rejected.length ? rejected.map(() => "stronger-candidate" as const) : ["other"],
            ),
            contextFit: contextFitAnalytics({
                chill: 1 - Math.abs(next.energy - 0.35),
                love: compatibility.experience,
                energy: 1 - Math.abs(next.energy - 0.75),
                party: (next.danceability + next.energy) / 2,
            }),
            confidence: analyticsConfidence(this.#memory.transitionHistory.length + 20),
            sourcePolicy: recommendationSourcePolicy("organic", {
                hardDislike: false,
                sessionFit: compatibility.experience,
                quality: qualityGuardianV3.guardian.experience,
            }),
        };
        const artistGovernance: DirectorArtistGovernance = {
            utility: multiStakeholderUtility(
                {
                    listener: compatibility.experience,
                    session: 1 - Math.abs(next.energy - session.targetEnergy),
                    crowd: grooveCrowdIntelligence.crowdLeadership.signalStrength,
                    journey: compatibilityRoute.futureScore,
                    artistRelationship: artistEcosystem.relationshipOpportunity.opportunity,
                    discovery: artistEcosystem.discoveryQuality.quality,
                    supplierFairness: artistEcosystem.exposureFairness.fairness,
                    repetition: fatigue.total,
                    artistSaturation: fatigue.artistRepetition,
                    popularityBias: 0,
                    risk: unifiedQuality.totalRisk,
                },
                recommendationV2.hardGates.allowed,
            ),
            consent: artistConsentTier(options.stemsReady ? "dj-mix" : "smart-transition", {
                preserveIntro: true,
                preserveOutro: true,
                preserveDrop: Boolean(next.drops?.length),
                allowStemMixing: options.stemsReady,
                official: false,
            }),
            experiment: artistExperimentPlan("relationship-continuity", compatibility.total >= 0.65),
        };
        const sessionContinuity: DirectorSessionContinuity = {
            handoffState: validateHandoffState({
                currentTrack: current.trackId,
                playbackPosition: options.currentPositionSec ?? 0,
                queue: [current.trackId, next.trackId, ...lookahead.map((profile) => profile.trackId)],
                history: this.#memory.transitionHistory.map((entry) => entry.fromTrackId),
                experience: experience.resolved,
                journey: journey.horizon.map((step) => `${step.role}:${step.targetEnergy}`),
                requests: [],
                currentContext: session.phase,
                tasteProfileScope: this.#learningSessionMode,
                plannedRoute: compatibilityRoute.trackIds,
                committedTransition: plan.type,
            }),
            timing: intelligentHandoffTiming({
                secondsToTransition: Math.max(0, cue.aStartPlaySec - (options.currentPositionSec ?? 0)),
                transitionCommitted: progressivePlan.state === "committed",
                complexStemHandoff: options.stemsReady,
                secondsToTrackEnd: Math.max(
                    0,
                    (current.durationSec ?? cue.aStartPlaySec) - (options.currentPositionSec ?? 0),
                ),
            }),
            capability: capabilityAwareHandoff(
                {
                    deviceId: "audio-master",
                    roles: ["audio-master"],
                    dspTier: 3,
                    stems: options.stemsReady,
                    sampleRate: 48_000,
                },
                {
                    deviceId: "target",
                    roles: ["audio-master", "controller"],
                    dspTier: realtimeReliability.qos.level === "safe-playback" ? 0 : 2,
                    stems: options.stemsReady,
                    sampleRate: 48_000,
                },
                experience.resolved,
            ),
            controls: surfaceControls("desktop"),
        };
        const canonicalRecording: CanonicalRecording = {
            recordingId: next.trackId,
            providers: [
                {
                    provider: "resolved-provider",
                    trackId: next.trackId,
                    isrc: `beatcord:${next.trackId}`,
                    availableMarkets: ["GLOBAL"],
                    lossless: true,
                    explicit: false,
                    version: "studio",
                    durationSec: next.durationSec ?? 180,
                },
            ],
            fingerprints: [],
            metadata: {
                title: next.trackId,
                primaryArtist: next.artist ?? "unknown",
                version: "studio",
                durationSec: next.durationSec ?? 180,
                isrc: `beatcord:${next.trackId}`,
            },
        };
        const crossProviderIdentity: DirectorCrossProviderIdentity = {
            queue: canonicalQueue([canonicalRecording]),
            version: versionMatch(canonicalRecording, canonicalRecording.providers[0]!),
            source: resolvePlaybackSource(
                canonicalRecording,
                { providers: ["resolved-provider"], market: "GLOBAL", lossless: true, explicitAllowed: true },
                { deviceId: "audio-master", lossless: true, providers: ["resolved-provider"] },
                { allowedProviders: ["resolved-provider"], recordingAllowed: true },
            ),
        };
        const socialType =
            experience.resolved === "party" ? "party" : experience.resolved === "love" ? "couple" : "friends";
        const socialParticipants = socialType === "couple" ? 2 : socialType === "party" ? 8 : 3;
        const socialSession: DirectorSocialSession = {
            context: socialContextPolicy(socialType, socialParticipants),
            hostPermissions: sessionPermissions("host", "host-approval"),
            presence: ambientMusicPresence("Beatcord host", experience.resolved, true),
        };
        const experienceIntegration: DirectorExperienceIntegration = {
            permissions: DEFAULT_SESSION_PERMISSIONS,
            ownership: ownershipIndicator(socialParticipants, "Beatcord host", "device"),
            event: eventDelivery("transition-started", "network-api"),
            circuitBreaker: integrationCircuitBreaker(0),
            lighting: lightingIntent({ energy: session.targetEnergy, tension: tension.cut.anticipation, confidence }),
            gameContext: gameIntegrationPolicy({
                state: "exploration",
                intensity: session.currentEnergy,
                confidence,
                adaptiveGamingMode: false,
            }),
        };
        const mobilityKaraokeMemory: DirectorMobilityKaraokeMemory = {
            driving: DRIVING_MODE,
            offlineUtility: availabilityAwareUtility(compatibility.total, 0.9, true, 0.3),
            haptic: hapticEvent("countdown", { enabled: true, reducedMotion: true }),
            karaoke: karaokeMode("party"),
            memory: buildSessionMemory(
                {
                    date: new Date(this.#now()).toISOString().slice(0, 10),
                    duration: session.sessionAgeMinutes * 60,
                    participants: socialParticipants,
                    tracks: [current.trackId, next.trackId],
                    discoveries: [],
                    reactions: session.userLikes,
                    peakMoments: session.peakReached ? ["energy-peak"] : [],
                    favoriteTransitions: [],
                },
                [],
            ),
        };
        const socialPrivacyUx: DirectorSocialPrivacyUx = {
            controls: progressiveControls("listener"),
            zeroConfiguration: ZERO_CONFIGURATION_EXPERIENCE,
            guestRequest: routeGuestRequest(false, Math.max(1, Math.round(plan.fadeSec))),
            recommendationValue: socialRecommendationValue({
                relationshipStrength: 0.7,
                senderTrust: 0.8,
                tasteCompatibility: compatibility.experience,
                trackFit: compatibility.total,
            }),
            social: SOCIAL_EXPERIENCE,
        };
        const integrationSdkAccessibility: DirectorIntegrationSdkAccessibility = {
            discovery: integrationDiscovery({ kind: "discord", detected: true, context: experience.resolved }),
            observationApi: sdkSurface("observation"),
            realtimeDelivery: eventDeliveryPolicy({ frequency: "realtime", remote: false }),
            accessibleControls: ACCESSIBLE_CONTROL_METHODS,
            motion: visualMotionPolicy("reduced", session.targetEnergy),
            searchScore: crossDeviceSearchScore({
                lexical: 0.7,
                semantic: compatibility.experience,
                transliteration: 0.5,
                typo: 0.5,
                artistGraph: artistEcosystem.relationshipOpportunity.opportunity,
                userContext: compatibilityRoute.futureScore,
            }),
            searchArchitecture: SEARCH_ARCHITECTURE,
        };
        const platformResilience: DirectorPlatformResilience = {
            accountSync: ACCOUNT_SYNC_SCOPE,
            command: commandPaletteAction(experience.requested === "auto" ? "play" : experience.requested),
            outage: cloudOutagePlan(true),
            requests: requestRateLimit(0, 0),
            memorySeed: memoryJourneySeed(current.trackId, experience.resolved),
            confidenceBehavior: confidenceActionPolicy(confidence),
        };
        const contextSerendipityTrust: DirectorContextSerendipityTrust = {
            context: resolveContext({
                explicit: { value: experience.resolved, confidence: 1 },
                social: { value: socialType, confidence: 0.8 },
                device: { value: "audio-master", confidence: 1 },
            }),
            contextChange: contextChangeDecision({
                explicit: experience.requested !== "auto",
                consistentSignals: session.userLikes > session.userSkips ? 2 : 1,
                averageConfidence: confidence,
            }),
            serendipity: serendipityValue({
                unexpected: familiarity.noveltyTarget,
                valuable: compatibility.total,
                contextuallyMeaningful: compatibility.experience,
                discoverableConnection: compatibilityRoute.futureScore,
            }),
            surpriseBalance: surpriseBalance({
                itemNovelty: familiarity.noveltyTarget,
                transitionNovelty: surpriseBudget.cost,
            }),
            discoveryBridge: discoveryBridge({
                surprise: familiarity.noveltyTarget,
                knownConnection: current.artist ?? current.trackId,
                destination: experience.resolved,
            }),
            recovery: recommendationRecovery(session.userSkips),
            truthfulState: truthfulStateLanguage(
                experience.requested === "auto"
                    ? { inferredDirection: experience.resolved }
                    : { explicitSelection: experience.resolved },
            ),
        };
        const qoeBuffer = adaptiveBufferHorizon({
            baseSeconds: B_PRE_ROLL_SEC,
            moment: plan.type === "fade" ? "normal" : "transition",
            networkQuality: realtimeReliability.qos.level === "full-hq-stems" ? 1 : 0.6,
            complexTransition: !["fade", "cut"].includes(plan.type),
        });
        const qualityOfExperience: DirectorQualityOfExperience = {
            score: qualityOfExperienceScore({
                playback: 1 - unifiedQuality.totalRisk,
                startup: 1,
                navigation: 1,
                search: integrationSdkAccessibility.searchScore,
                recommendationLatency: 0.9,
                sessionSync: distributedRecovery.clock.syncConfidence,
                handoff: sessionContinuity.timing.safety === "now" ? 1 : 0.8,
                integrationHealth: experienceIntegration.circuitBreaker.state === "closed" ? 1 : 0.5,
            }),
            buffer: qoeBuffer,
            readiness: transitionReadiness(options.fadeSec, qoeBuffer.targetSeconds),
            routeScore: qoeAwareRouteScore({
                musicalFit: compatibility.total,
                availabilityConfidence: mobilityKaraokeMemory.offlineUtility,
                bufferReadiness: Math.min(1, options.fadeSec / Math.max(1, qoeBuffer.targetSeconds)),
            }),
            streaming: streamingDegradation(0.8, true),
            dsp: dspDegradation(realtimeReliability.qos.level === "full-hq-stems" ? 0.9 : 0.4),
            aiResponse: aiResponseRoute("More energy"),
        };
        const experienceQoeGovernance: DirectorExperienceQoeGovernance = {
            intent: intentExecutionPath("more-energy"),
            guardian: qoeGuardian({
                network: qualityOfExperience.streaming.quality === "lossless" ? 1 : 0.7,
                cpu: qualityOfExperience.dsp.quality === "stem-hq" ? 1 : 0.7,
                buffer: qualityOfExperience.readiness.action === "proceed" ? 1 : 0.5,
                device: realtimeReliability.route.clubPerformanceSafe ? 1 : 0.4,
                search: integrationSdkAccessibility.searchScore,
                ai: qualityOfExperience.aiResponse.cloudRequired ? 0.7 : 1,
                social: 1 - session.userSkips / Math.max(1, session.userLikes + session.userSkips),
                integrations: experienceIntegration.circuitBreaker.state === "closed" ? 1 : 0.5,
            }),
            failureBudget: failureBudgetStatus({
                audioInterruptionsPer100Hours: 0,
                transitionFailuresPer1000: unifiedQuality.approved ? 0 : 1,
                sessionDesyncPer100Sessions: 0,
                searchTimeoutRate: 0,
                aiCommandFailureRate: 0,
            }),
            scorecard: experienceScorecard({
                audioReliability: 1 - unifiedQuality.totalRisk,
                sessionSatisfaction: compatibility.experience,
                recommendationAcceptance: 1 - fatigue.total,
                trust: contextSerendipityTrust.recovery.autonomyMultiplier,
                discovery: familiarity.noveltyTarget,
                socialEnjoyment:
                    1 - Math.min(1, session.userSkips / Math.max(1, session.userLikes + session.userSkips)),
                wouldUseAgain: compatibility.total,
            }),
        };
        const providerTier = options.stemsReady ? "OWNED_OR_LICENSED_AUDIO" : "PLAYBACK_ONLY";
        const providerInnovation: DirectorProviderInnovation = {
            capabilities: providerCapabilities(providerTier),
            mixing: assertProviderAction(providerTier, "mix"),
            validation: validateInnovation({
                userValue: 5,
                technicalFeasibility: 4,
                differentiation: 5,
                rightsDependency: options.stemsReady ? 5 : 3,
                validationStrength: 4,
            }),
            experienceDna: morphExperienceDna(
                EXPERIENCE_DNA_PRESETS.chill,
                EXPERIENCE_DNA_PRESETS[experience.resolved],
                { confidence, manualIntent: experience.requested !== "auto", maxStep: 0.25 },
            ),
        };
        const validatedRoute = {
            trackIds: [next.trackId, ...lookahead.slice(0, 3).map((profile) => profile.trackId)],
            satisfaction: compatibility.total,
            journeyProgress: compatibilityRoute.futureScore,
            transitionQuality: 1 - unifiedQuality.totalRisk,
            crowdFit: grooveCrowdIntelligence.crowdLeadership.signalStrength,
            requestProgress: 0,
            diversity: familiarity.noveltyTarget,
            uncertainty: 1 - confidence,
            repetition: fatigue.total,
            manipulationCost: roundedBudget.total,
        };
        const validatedInnovations: DirectorValidatedInnovations = {
            moment: momentLevelCandidate({
                trackId: next.trackId,
                moment: next.drops?.length ? "drop" : "chorus",
                timeToMoment: next.drops?.[0]?.start ?? next.durationSec ?? 0,
                confidence,
                familiarity: familiarity.familiarityTarget,
                energyDelta: next.energy - current.energy,
            }),
            route: rollingHorizon([validatedRoute]),
            roleMixing: roleBasedMixing(providerTier, ["vocal", "drums", "bass", "other"]),
            critic: transitionCriticStage("symbolic", 0),
            repair: localTransitionRepair(
                current.confidence.beatGrid < 0.5
                    ? "grid-uncertainty"
                    : options.stemsReady
                      ? "vocal-conflict"
                      : "bass-collision",
            ),
            crowd: crowdCoDirector({
                profiles: socialParticipants,
                requests: 0,
                likes: session.userLikes,
                reactions: 0,
                skipVotes: session.userSkips,
                participants: socialParticipants,
            }),
            copilot: compileSessionLanguage("More energy"),
            ecosystemEvent: semanticEcosystemEvent("TRACK_CHANGED"),
            directorAction: noActionPolicy({
                confidence,
                artisticallyImportant: continuityPolicy.preserveAlbumSequence,
                crowdResponse: grooveCrowdIntelligence.crowdLeadership.signalStrength,
                networkRisk: 1 - mobilityKaraokeMemory.offlineUtility,
                budget: {
                    transitionManipulation: roundedBudget.total,
                    reorderFrequency: 0,
                    novelty: surpriseBudget.used,
                    tempoManipulation: stretchDecision.risk.total,
                },
            }),
        };
        const productStrategy: DirectorProductStrategy = {
            transport: transportProfile("local-pcm"),
            package: productPackage("v1"),
            bestEffortRatio: BEST_INNOVATION_EFFORT_RATIO,
            deferred: DEFERRED_FEATURES,
        };
        const businessValidation: DirectorBusinessValidation = {
            catalogAccess: selectCatalogAccess([
                {
                    path: options.stemsReady ? "local-user-owned" : "multiple-capability-tiers",
                    legalTransformAccess: options.stemsReady,
                    rawAudioAccess: options.stemsReady,
                    catalogBreadth: options.stemsReady ? 0.4 : 0.9,
                    dependencyRisk: options.stemsReady ? 0.05 : 0.4,
                },
            ]),
            lane: innovationLane(options.stemsReady ? "four-stem-role-mixing" : "experience-dna"),
            intrusiveness: productIntrusiveness({
                visibleAiDecisions: validatedInnovations.directorAction.action === "do-nothing" ? 0 : 0.2,
                modeChanges: experience.requested === "auto" ? 0 : 0.1,
                effectSalience: roundedBudget.effects,
                reorderSurprises: 0,
            }),
        };
        const outgoingPulse = pulseHierarchy(current.bpm, current.confidence.overall);
        const incomingPulse = pulseHierarchy(next.bpm, next.confidence.overall);
        const adaptiveBeatMesh: DirectorAdaptiveBeatMesh = {
            outgoingPulse,
            incomingPulse,
            compatibility: compatiblePulse(outgoingPulse, incomingPulse),
            consensus: beatConsensus(
                [
                    {
                        source: "full-mix",
                        onsetTimes: [],
                        periodicities: [current.bpm],
                        accentStrength: [],
                        confidence: current.confidence.beatGrid,
                    },
                    {
                        source: "drums",
                        onsetTimes: [],
                        periodicities: [current.bpm],
                        accentStrength: [],
                        confidence: current.confidence.structure,
                    },
                ],
                Math.min(1, Math.abs(beatgridV2.phase.phaseDriftMsPerSec) / 20),
            ),
            confidenceIsland: confidenceIsland(
                current.sections.map((section, index) => ({
                    sectionId: `${section.type}-${index}`,
                    confidence: current.confidence.beatGrid,
                    start: section.start,
                    end: section.end,
                })),
                0.5,
            ),
            mixGrid: transitionMixGrid(
                [Math.max(0, cue.aStartPlaySec), Math.max(0, cue.aStartPlaySec + plan.fadeSec)],
                [0, plan.fadeSec],
            ),
            compute: analysisFoveation("committed"),
            state: classifyGridResidual([
                beatgridV2.phase.phaseErrorMs / 1_000,
                beatgridV2.phase.phaseDriftMsPerSec / 1_000,
            ]),
            grooveStrategy: grooveMixStrategy(1 - Math.abs(current.danceability - next.danceability)),
        };
        const hierarchicalStemMixing: DirectorHierarchicalStemMixing = {
            demand: planStemDemand(
                options.stemsReady ? "vocal-removal" : "classic-mix",
                1 - unifiedQuality.stemArtifacts,
                plan.fadeSec * 1_000,
            ),
            pipeline: stemPipeline({
                baseQuality: stemQualityValue,
                restorationBenefit: stemSequential.restoration.apply ? 0.75 : 0.4,
                restorationRisk: performancePolicy.stemArtifacts.risk,
                transitionUtility: compatibility.total,
                windowSeconds: plan.fadeSec,
            }),
            reconstruction: hybridReconstruction({
                residualCoherence: 1 - perceptualMasking.risk,
                fullReconstructionQuality: stemQualityValue,
            }),
            spatialGate: spatialStemGate(
                {
                    interChannelPhase: 1 - perceptualMasking.risk,
                    stereoImagePreservation: 0.9,
                    localizationStability: 0.9,
                    monoCompatibility: qualityGuardianV3.monoSafety.safe ? 1 : 0.5,
                },
                "party-speaker",
            ),
            meter: meterAlignment("4/4", "4/4", Math.min(current.confidence.beatGrid, next.confidence.beatGrid)),
            harmony: harmonicOwnership(1 - compatibility.key),
            manipulationCost: perceptualManipulationCost({
                tempoWarp: roundedBudget.timeStretch,
                pitchShift: roundedBudget.pitchShift,
                stemExposure: roundedBudget.stemMixing,
                eqChange: roundedBudget.effects,
                fxIntensity: roundedBudget.effects,
                structuralEditing: roundedBudget.structureEditing,
            }),
        };
        const cheapMixability = cheapMixabilityPredictor({
            tempo: compatibility.tempo,
            rhythmEmbedding: 1 - Math.abs(current.danceability - next.danceability),
            structure: compatibility.phrase,
            vocalProbability: perceptualMasking.vocalCollision,
            harmonicActivity: 1 - compatibility.key,
            timbre: compatibility.timbre,
        });
        const difficulty = mixDifficulty({
            tempoGap: 1 - compatibility.tempo,
            gridUncertainty: 1 - Math.min(current.confidence.beatGrid, next.confidence.beatGrid),
            meterMismatch: 0,
            vocalDensity: perceptualMasking.vocalCollision,
            harmonicConflict: 1 - compatibility.key,
            stemQualityRisk: 1 - stemQualityValue,
            structuralIncompatibility: 1 - compatibility.phrase,
            timbreShock: 1 - compatibility.timbre,
        });
        const robustTransitionFunnel: DirectorRobustTransitionFunnel = {
            counterfactual: counterfactualMixSearch([
                {
                    strategy: "preserve-cut-tail",
                    value: compatibility.total,
                    risk: unifiedQuality.totalRisk * 0.5,
                    manipulation: 0.1,
                },
                {
                    strategy: "classic-eq-blend",
                    value: compatibility.total + 0.1,
                    risk: unifiedQuality.totalRisk,
                    manipulation: roundedBudget.effects,
                },
                {
                    strategy: "stem-role-handoff",
                    value: compatibility.total + 0.2,
                    risk: 1 - stemQualityValue,
                    manipulation: roundedBudget.stemMixing,
                },
            ]),
            robustness: transitionRobustness(
                1 - unifiedQuality.totalRisk,
                {
                    bpmDelta: 0.2,
                    phaseMs: Math.abs(beatgridV2.phase.phaseErrorMs),
                    stemQualityDelta: 1 - stemQualityValue,
                },
                0.6,
            ),
            difficulty,
            cheapMixability,
            recommendationScore: transitionAwareRecommendationScore({
                recommendationFit: compatibility.experience,
                estimatedMixability: cheapMixability,
                transitionDifficulty: difficulty.score,
            }),
            funnel: analysisFunnel(),
        };
        const analyzerIdentityDifference = identityDifference({
            rhythm: 1 - compatibility.beat,
            melody: 1 - compatibility.key,
            timbre: 1 - compatibility.timbre,
            spatial: qualityGuardianV3.monoSafety.safe ? 0 : 0.5,
        });
        const analyzerKnowledge: DirectorAnalyzerKnowledge = {
            analyzer: analyzerRouter(
                [
                    {
                        analyzer: "full-mix",
                        domain: next.genres[0]?.genre ?? "unknown",
                        section: "any",
                        confidence,
                        success: current.confidence.beatGrid,
                        samples: 20,
                    },
                    {
                        analyzer: "drum-consensus",
                        domain: next.genres[0]?.genre ?? "unknown",
                        section: "outro",
                        confidence,
                        success: adaptiveBeatMesh.consensus.confidence,
                        samples: 20,
                    },
                ],
                next.genres[0]?.genre ?? "unknown",
                "outro",
            ),
            provenance: provenanceWeightedAnalysis([
                { value: next.bpm, provenance: "beatcord-model", confidence: next.confidence.beatGrid },
            ]),
            syncTightness: personalizedSyncTightness({
                style: experience.resolved === "party" ? "club-edm" : "other",
                userPreference: performanceStyle.style.tempoFlexibility,
            }),
            requiredStemQuality: requiredStemQuality(
                roundedBudget.stemMixing,
                perceptualMasking.foreground.incoming.signatureHook,
                Math.min(1, plan.fadeSec / 32),
            ),
            loopScore: artifactAwareLoopScore(loopability?.total ?? 0, performancePolicy.stemArtifacts.risk, 4),
            strategyPrior: distilledStrategyPrior(
                candidateScores.map((candidate) => ({
                    strategy: candidate.type,
                    probability: candidate.directorScore ?? candidate.plannerScore,
                })),
            ),
            enhancement: degradationAwareEnhancement(
                { codecDamage: 0, noise: 0, clipping: unifiedQuality.clippingRisk, bandwidthLoss: 0 },
                confidence,
            ),
            restoration: djSafeRestoration({
                transitionUtilityGain: compatibility.total - unifiedQuality.totalRisk,
                identityDifference: analyzerIdentityDifference,
                threshold: 0.25,
            }),
        };
        const musicalCompiler: DirectorMusicalCompiler = {
            deadline: deadlineTask("compile-transition", 0, Math.max(1, Math.round(plan.fadeSec * 48_000)), 24_000),
            risk: composedMusicalRisk({
                gridRisk: 1 - adaptiveBeatMesh.consensus.confidence,
                harmonicRisk: 1 - compatibility.key,
                stemRisk: 1 - stemQualityValue,
                manipulationRisk: hierarchicalStemMixing.manipulationCost,
            }),
            canvas: perceptualMixingCanvas(
                {
                    density: current.complexity,
                    foregroundCount: current.vocalness + current.intensity,
                    spectralOccupancy: perceptualMasking.spectralCongestion,
                    rhythmicDensity: current.danceability,
                },
                {
                    density: next.complexity,
                    foregroundCount: next.vocalness + next.intensity,
                    spectralOccupancy: perceptualMasking.spectralCongestion,
                    rhythmicDensity: next.danceability,
                },
            ),
            compilation: compileMusicalIr({
                version: 1,
                beatMesh: adaptiveBeatMesh.state,
                tempoMap: `${current.bpm}->${next.bpm}`,
                grooveField: adaptiveBeatMesh.grooveStrategy,
                meterMap: hierarchicalStemMixing.meter.strategy,
                structureGraph: `${current.sections.length}:${next.sections.length}`,
                harmonyTimeline: hierarchicalStemMixing.harmony.corridor,
                roleTimeline: validatedInnovations.roleMixing.roles.join(","),
                complexityTimeline: `${current.complexity}:${next.complexity}`,
                stemCapabilities: providerInnovation.capabilities.stems ? ["vocals", "drums", "bass", "other"] : [],
                confidenceMap: { beat: adaptiveBeatMesh.consensus.confidence, overall: confidence },
                modelVersions: { beat: "adaptive-beat-mesh-v1", stems: "hierarchical-stem-v1" },
            }),
        };
        const movement = {
            cadence: next.bpm,
            accentPattern: [next.danceability],
            groove: next.danceability,
            barPhase: 0,
            contactPattern: [1],
            confidence,
        };
        const perceptualPlayback: DirectorPerceptualPlayback = {
            playbackPolicy: adaptivePlaybackPolicy({
                outputDevice: {
                    type: "speaker",
                    dynamicCapability: 0.8,
                    maxReliableBass: 0.8,
                    spatialCapability: 0.5,
                    calibrationConfidence: 0.7,
                },
                userAudioPreferences: { clarity: 0.7, bass: 0.6, dynamics: 0.8 },
                confidence: 0.7,
            }),
            masterBudget: adaptiveMasterBudget(experience.resolved),
            ambientProtection: ambientLoudnessProtection(0),
            safeEnergy: safeEnergyStrategy(session.targetEnergy),
            conversation: conversationSafeJourney(null, 30),
            spatialProfile: spatialProfilePolicy(null),
            spatialHandoff: spatialRoleHandoff(
                [
                    { role: "vocal", azimuth: 0, width: 0.2 },
                    { role: "drums", azimuth: 0, width: 0.6 },
                ],
                false,
            ),
            haptics: hapticRoleMix("phone", {
                pulse: [],
                bass: [],
                moments: [{ time: cue.aStartPlaySec, intensity: session.targetEnergy, kind: "transition" }],
            }),
            motionCompatibility: motionCompatibility(movement, movement),
            bioadaptive: bioadaptiveEnergy({ activityLevel: session.currentEnergy, confidence }, "workout"),
        };
        const causalEvidence = causalPreferenceEvidence(
            {
                wasUserSelected: false,
                recommendationSource: "director",
                rankPosition: 1,
                explorationProbability: familiarity.noveltyTarget,
                propensity: Math.max(0.1, recommendationV2.score),
                contextSpecific: true,
                algorithmicRepeatCount: 1,
            },
            session.userSkips > session.userLikes ? "skip" : "completed",
        );
        const causalTaste: DirectorCausalTaste = {
            evidence: causalEvidence,
            firewall: causalPreferenceFirewall({ evidence: causalEvidence, algorithmForced: true, sessionOnly: true }),
        };
        const explorationCalibration = calibratedConfidence(
            [
                {
                    analyzer: "transition-director",
                    domain: next.genres[0]?.genre ?? "unknown",
                    predictedConfidence: confidence,
                    correct: robustTransitionFunnel.robustness.robust,
                },
            ],
            "transition-director",
            next.genres[0]?.genre ?? "unknown",
            confidence,
        );
        const explorationUncertaintyTeaching: DirectorExplorationUncertaintyTeaching = {
            ledger: {
                trackId: next.trackId,
                policy: "contextual-bandit-micro-exploration-v1",
                probability: familiarity.noveltyTarget,
                reason: "one controlled discovery dimension with stable musical constraints",
                context: `${session.phase}:${experience.resolved}`,
            },
            exploration: microExploration({
                candidateDistance: familiarity.noveltyTarget * 0.3,
                genreFit: compatibility.genre,
                energyFit: compatibility.energy,
                transitionSafety: 1 - unifiedQuality.totalRisk,
            }),
            calibration: explorationCalibration,
            decisionConfidence: decisionConfidence(
                explorationCalibration.calibrated,
                robustTransitionFunnel.robustness.robustness,
            ),
            envelope: conformalActionEnvelope(
                candidateScores.map((candidate) => ({
                    transition: candidate.type,
                    success: candidate.eligible ? 1 - unifiedQuality.totalRisk : 0,
                })),
                0.8,
            ),
            teaching: activeTeachingValue({
                uncertainty: 1 - explorationCalibration.calibrated,
                expectedFutureUse: 0.8,
                correctionValue: 0.8,
                mode: "normal",
            }),
            correctionDependencies: correctionPropagation("move-downbeat"),
            adapter: fewShotAdapter({
                domain: next.genres[0]?.genre ?? "unknown",
                corrections: 0,
                highConfidenceLabels: 0,
                globalModelMutation: false,
            }),
            domainGuard: culturalDomainGuard(1 - (next.genres[0]?.confidence ?? 0)),
            diffusion: diffusionStemEscalation({
                fastStemQuality: stemQualityValue,
                transitionImportance: session.targetEnergy,
                computeAvailable: this.#capabilities.offlineAnalysis,
                lookahead: true,
            }),
        };
        const stemPortfolioModel = routeStemJob(
            [
                {
                    id: "local-realtime-generalist",
                    roles: ["full-mix", "drums", "bass"],
                    sections: ["transition"],
                    realtime: true,
                    spatialQuality: 0.5,
                    deviceTiers: ["desktop"],
                    objectiveQuality: stemQualityValue,
                    humanUtility: compatibility.total,
                    maxLatencyMs: 40,
                },
                {
                    id: "server-hq-specialist",
                    roles: ["full-mix", "drums", "bass", "vocals", "other"],
                    sections: ["transition"],
                    realtime: false,
                    spatialQuality: 0.9,
                    deviceTiers: ["desktop"],
                    objectiveQuality: Math.min(1, stemQualityValue + 0.1),
                    humanUtility: compatibility.total,
                    maxLatencyMs: 500,
                },
            ],
            {
                role: plan.type === "acapella" ? "vocals" : "full-mix",
                sectionType: "transition",
                realtime: true,
                spatialRequirement: 0.4,
                device: "desktop",
                deadlineMs: 100,
            },
        );
        const stemComputeProvenanceV2: DirectorStemComputeProvenanceV2 = {
            alignmentPipeline: VERSION_ALIGNMENT_PIPELINE,
            versionPrior: versionAssistedStem({
                fingerprintMatch: 1,
                timingMatch: compatibility.tempo,
                spectralMatch: compatibility.timbre,
                phaseCoherence: adaptiveBeatMesh.consensus.confidence,
            }),
            residual: reconstructionResidual({
                originalEnergy: 1,
                summedStemEnergy: stemQualityValue,
                coherence: adaptiveBeatMesh.consensus.confidence,
            }),
            spatialIntegrity: spatialIntegrityGate({
                interauralTiming: compatibility.beat,
                levelDifference: 1 - unifiedQuality.clippingRisk,
                stereoWidth: qualityGuardianV3.monoSafety.safe ? 0.8 : 0.4,
                localization: compatibility.timbre,
            }),
            bakeOff: perceptualStemBakeOff([
                {
                    model: "local-realtime-generalist",
                    objectiveQuality: stemQualityValue,
                    humanUtility: compatibility.total,
                },
                { model: "original-master", objectiveQuality: 1, humanUtility: 1 - roundedBudget.stemMixing },
            ]),
            model: stemPortfolioModel,
            localSpecialists: TINY_LOCAL_SPECIALISTS,
            placement: computePlacement("heavy-stems", ["audio-master", "desktop-server", "phone"]),
            migration: computeMigration("phone", "desktop-server", "hq-analysis"),
            provenance: decisionProvenanceGraph(plan.type, [
                {
                    source: "transition-compatibility",
                    weight: compatibility.total,
                    modelVersion: "track-compatibility-v2",
                },
                {
                    source: "robustness",
                    weight: robustTransitionFunnel.robustness.robustness,
                    modelVersion: "robust-transition-funnel-v1",
                },
                { source: "human-utility", weight: recommendationV2.score, modelVersion: "recommendation-routing-v2" },
            ]),
            shadow: shadowDirector(
                [{ model: "counterfactual-director-v1", trackId: next.trackId }],
                causalEvidence.longTermEligible,
            ),
            selfInfluence: recommendationSelfInfluence(causalEvidence.weight, 1),
        };
        const currentPositionSec = options.currentPositionSec ?? cue.aStartPlaySec;
        const futureSections = current.sections
            .filter((section) => section.start >= currentPositionSec)
            .map((section) => ({
                type: section.type,
                startsInSec: Math.max(0, section.start - currentPositionSec),
                energy: section.energy,
                confidence: section.structureConfidence,
            }));
        const sectionIntent = sectionAwareIntent({
            desiredEnergy: session.targetEnergy,
            currentEnergy: session.currentEnergy,
            futureSections,
        });
        const multisensoryAttentionExperience: DirectorMultisensoryAttentionExperience = {
            movementBridge: embodiedDiscoveryScore(movement, movement),
            moment: multisensoryMomentPlan(cue.aStartPlaySec * 1_000, [
                { channel: "audio", offsetMs: 0, payload: plan.type, importance: "very-high" },
                { channel: "spatial", offsetMs: 10, payload: "role-handoff", importance: "high" },
                { channel: "haptics", offsetMs: 20, payload: "transition-pulse", importance: "high" },
                { channel: "lighting", offsetMs: 50, payload: "energy-cue", importance: "low" },
            ]),
            precision: importancePrecision("very-high"),
            attention: attentionPreservingQueue({
                importantMomentInSec: Math.max(0, cue.aStartPlaySec - currentPositionSec),
                extensibleSafeSection: loopability !== null,
            }),
            resume: experienceResumePoint({
                interruptedSection: "other",
                interruptionMinutes: 0,
                replayAllowed: true,
            }),
            listeningEffort: listeningEffortPolicy("natural"),
            silence: contextualSilence("normal"),
            sectionIntent,
            opportunityCost: temporalOpportunityCost({
                skipLosesMomentValue: tension.cut.blocked ? tension.cut.anticipation : 0,
                waitSeconds: sectionIntent.section?.startsInSec ?? 0,
                desiredStateUrgency: Math.abs(session.targetEnergy - session.currentEnergy),
            }),
            precisionPipeline: ADAPTIVE_PRECISION_PIPELINE_V2,
            program: compileExperienceProgram(
                {
                    audio: plan.type,
                    spatial: "role-aware-handoff",
                    haptics: "transition-pulse",
                    lighting: "energy-cue",
                    visuals: "optional-moment",
                    futureMoments: futureSections.map((section) => ({ at: section.startsInSec, type: section.type })),
                    confidence: explorationCalibration.calibrated,
                    fallback: "original-master",
                },
                {
                    audio: providerInnovation.capabilities.providerPlayback,
                    spatial: providerInnovation.capabilities.approvedMixing,
                },
            ),
            priorities: {
                build: ROUND_II_BUILD,
                prototypes: ROUND_II_PROTOTYPES,
                research: ROUND_II_RESEARCH,
                perceptualOsQuestions: PERCEPTUAL_OS_QUESTIONS,
            },
        };
        const twinConfidenceInput = {
            deviceIdentification: 0.5,
            frequencyResponseKnowledge: 0.3,
            environmentKnowledge: 0.2,
            spatialProfileQuality: 0.3,
            userPreferenceEvidence: 0.5,
        };
        const exposure: ExposureLedgerEntryV2 = {
            trackId: next.trackId,
            exposureSource: "beatcord-recommendation",
            rankPosition: 1,
            explorationPolicy: explorationUncertaintyTeaching.ledger.policy,
            policyVersion: DIRECTOR_VERSION,
            estimatedPropensity: Math.max(0.1, recommendationV2.score),
            context: `${session.phase}:${experience.resolved}`,
            recentAlgorithmicExposureCount: 1,
        };
        const playbackTwinCausalLedgerV2: DirectorPlaybackTwinCausalLedgerV2 = {
            confidence: playbackTwinConfidence(twinConfidenceInput),
            differenceBudget: perceptualDifferenceBudget(experience.resolved === "party" ? "party" : "chill", false),
            policy: playbackTwinPolicy({
                device: {
                    deviceClass: "speaker",
                    form: "speaker",
                    frequencyResponseKnown: false,
                    maxOutputKnown: false,
                    latencyKnown: false,
                },
                environment: { noiseLevelClass: "quiet", confidence: 0.2, ephemeral: true },
                confidence: twinConfidenceInput,
            }),
            experiment: playbackTwinExperiment("suggested", {
                preference: 0.5,
                clarity: 0.5,
                naturalness: 0.8,
                artistFidelity: 1,
                fatigue: 0.2,
            }),
            exposure,
            agency: exposureAgencyWeight(exposure, session.userSkips > session.userLikes ? "no-skip" : "complete"),
        };
        const planMonteCarlo = transitionMonteCarlo({
            baseQuality: 1 - unifiedQuality.totalRisk,
            bpmUncertainty: 1 - compatibility.tempo,
            phaseUncertainty: Math.min(1, Math.abs(beatgridV2.phase.phaseErrorMs) / 500),
            keyUncertainty: 1 - compatibility.key,
            stemUncertainty: 1 - stemQualityValue,
            qualityFloor: 0.6,
        });
        const causalDecisionConfidenceV3: DirectorCausalDecisionConfidenceV3 = {
            taste: counterfactualTasteMemory({
                consumptionSignals: [session.userSkips > session.userLikes ? 0.2 : 0.8],
                voluntarySignals: [session.userLikes > 0 ? 0.9 : 0.4],
                recommendationSignals: [Math.max(0, causalEvidence.weight)],
            }),
            exploration: microRandomizedRecommendation(
                candidateScores.map((candidate) => ({
                    id: candidate.type,
                    quality: candidate.eligible ? Math.min(1, candidate.directorScore ?? candidate.plannerScore) : 0,
                })),
                0.8,
                next.trackId.length,
            ),
            firewall: causalTasteFirewallV2({
                agency: playbackTwinCausalLedgerV2.agency.weight,
                contextSpecific: true,
                algorithmicExposure: 0.8,
                repeatCount: exposure.recentAlgorithmicExposureCount,
                sessionOnly: true,
                signal: causalEvidence.weight,
            }),
            alarm: selfInfluenceAlarm({
                selfInfluence: stemComputeProvenanceV2.selfInfluence.ratio,
                algorithmicExposureConcentration: 0.8,
                artistConcentration: 0.5,
                genreConcentration: 0.5,
                voluntarySearchDiversity: 0.4,
                discoveryAcceptance: session.userLikes / Math.max(1, session.userLikes + session.userSkips),
                recommendationOriginShare: 0.8,
            }),
            confidence: confidenceStack(
                [
                    {
                        confidence: {
                            rawModelConfidence: confidence,
                            calibratedConfidence: explorationCalibration.calibrated,
                            domainCalibration: next.genres[0]?.confidence ?? 0,
                            sectionCalibration: next.confidence.structure,
                        },
                        relevance: 1,
                    },
                    {
                        confidence: {
                            rawModelConfidence: next.confidence.key,
                            calibratedConfidence: next.confidence.key,
                            domainCalibration: next.confidence.key,
                            sectionCalibration: next.confidence.key,
                        },
                        relevance: plan.type === "acapella" || plan.type === "blend" ? 1 : 0.1,
                    },
                ],
                planMonteCarlo.robustness,
            ),
            monteCarlo: planMonteCarlo,
            actions: safeActionSet(
                candidateScores.map((candidate) => ({
                    action: candidate.type,
                    robustness: candidate.eligible ? planMonteCarlo.robustness : 0,
                })),
            ),
            benchmark: calibrationBenchmark([
                {
                    predicted: confidence,
                    correct: unifiedQuality.approved,
                    catastrophic: !unifiedQuality.approved && unifiedQuality.totalRisk > 0.8,
                },
            ]),
            drift: calibrationDrift({
                baselineError: 0.1,
                currentError: Math.abs(confidence - (unifiedQuality.approved ? 1 : 0)),
                modelVersionChanged: false,
                domainShift: 1 - (next.genres[0]?.confidence ?? 0),
            }),
        };
        const semanticEvent = "quiet" as const;
        const semanticListeningV1: DirectorSemanticListeningV1 = {
            level: semanticListeningLevel(1),
            bus: semanticListeningBus({
                event: semanticEvent,
                confidence: 0.9,
                locallyExtracted: true,
                rawAudioStored: false,
            }),
            response: semanticResponse(semanticEvent, 0.9, Math.max(0, cue.aStartPlaySec - currentPositionSec)),
            momentProtection: semanticMomentProtection({
                event: semanticEvent,
                eventConfidence: 0.9,
                momentInSec: Math.max(0, cue.aStartPlaySec - currentPositionSec),
                lowForegroundAvailable: true,
            }),
            spectralPocket: spectralConversationPocket({ allowed: true, validated: false, speechConfidence: 0 }),
            control: applySemanticControl(semanticEvent, {
                mode: "balanced",
                alwaysAllow: ["warning", "traffic"],
                allow: ["user-speaking", "announcement"],
                ignore: ["crowd"],
                explicit: true,
            }),
            hardwareBoundary: semanticHardwareBoundary(1, "app"),
        };
        const beatCommittee = queryByCommittee([
            {
                source: "full-mix",
                bpm: current.bpm,
                phase: 0,
                meter: 4,
                confidence: current.confidence.beatGrid,
            },
            {
                source: "foundation",
                bpm: next.bpm,
                phase: Math.min(1, Math.abs(beatgridV2.phase.phaseErrorMs) / 500),
                meter: 4,
                confidence: next.confidence.beatGrid,
            },
            {
                source: "drum-stem",
                bpm: next.bpm,
                phase: 0,
                meter: 4,
                confidence: stemQualityValue,
            },
        ]);
        const beatAnnotationValue = annotationValue({
            uncertainty: beatCommittee.disagreement.expectedImpact,
            expectedTransitionUse: 1,
            downstreamDependencyCount: 6,
        });
        const constrainedBeatMesh = applyBeatConstraints(beatCommittee.primary ? [beatCommittee.primary] : [], []);
        const beatMemory = beatMeshMemory({
            trackId: next.trackId,
            constraints: [],
            interpretations: constrainedBeatMesh.hypotheses.map((hypothesis) => ({
                bpm: hypothesis.bpm,
                meter: hypothesis.meter,
                confidence: hypothesis.confidence,
            })),
            preferredDjPulse: constrainedBeatMesh.hypotheses[0]?.bpm ?? next.bpm,
        });
        const activeBeatMeshV2: DirectorActiveBeatMeshV2 = {
            committee: beatCommittee,
            annotationValue: beatAnnotationValue,
            teaching: activeTeachingPrompt({
                mode: "normal",
                value: beatAnnotationValue,
                pulseOptions: [current.bpm, next.bpm],
            }),
            constrained: constrainedBeatMesh,
            memory: beatMemory,
            community: trustedCommunityCorrection([]),
            djPulse: selectDjPulse(beatMemory.interpretations, beatMemory.preferredDjPulse),
            implementation: TOP_FIVE_IMPLEMENTATION,
            measurement: TOP_FIVE_MEASUREMENT,
        };
        const nativeSource = {
            sampleRate: 48_000,
            bitDepth: 24,
            lossless: providerInnovation.capabilities.rawAudio,
            nativeResolutionKnown: false,
            provenance: "unknown" as const,
        };
        const audioSourceResolutionPolicy: DirectorAudioSourceResolutionPolicy = {
            layers: AUDIO_STACK_LAYERS,
            flacPolicy: FLAC_POLICY,
            pipeline: decodeProcessingPipeline("flac"),
            source: sourceResolution(nativeSource, 48_000),
            validation: validateNativeResolution(nativeSource),
        };
        const processingRequested = plan.fadeSec > 0.1 || plan.eqSweep || plan.tempoRatio !== 1;
        const contentExtent = {
            rawDecodedStart: 0,
            contentStart: 0,
            contentEnd: Math.round((next.durationSec ?? 0) * 48_000),
        };
        const dspPrecisionGaplessPolicy: DirectorDspPrecisionGaplessPolicy = {
            precision: internalDspPrecision("realtime"),
            quantization: finalQuantization(16),
            sampleRate: sampleRateLane({
                sourceRate: nativeSource.sampleRate,
                deviceRate: 48_000,
                processingRequested,
                spatial: false,
            }),
            bitPerfect: bitPerfectBypass({
                lossless: nativeSource.lossless,
                processingRequested,
                sourceRate: nativeSource.sampleRate,
                deviceRate: 48_000,
                outputIntegerCompatible: true,
                systemMixerTransparent: false,
            }),
            timeline: canonicalContentTimeline(contentExtent, 0),
            gapless: gaplessIntegrity({
                missingSamples: 0,
                duplicateSamples: 0,
                addedSilenceSamples: 0,
                phaseDiscontinuity: 0,
                timingOffsetSamples: 0,
            }),
            immersiveDelivery: immersiveDeliveryCapability("IAMF"),
            resampler: RESAMPLER_POLICY,
        };
        const immersiveRenderingV1: DirectorImmersiveRenderingV1 = {
            presentationName: spatialPresentationName("unknown"),
            atmosValidation: atmosDeliveryValidation({
                provenance: "unknown",
                bitDepth: nativeSource.bitDepth,
                sampleRate: nativeSource.sampleRate,
                integratedLkfs: -18,
                truePeakDbtp: -1,
                createdByDemixingStereo: false,
            }),
            backends: IMMERSIVE_BACKENDS,
            openLab: OPEN_IMMERSIVE_LAB,
            ffmpeg: ffmpegRole({
                decoders: ["flac", "aac"],
                encoders: ["flac", "opus"],
                demuxers: ["flac", "mov"],
                muxers: ["flac", "ogg"],
                filters: ["loudnorm"],
                libraries: { rubberband: true, soxr: true, mpegh: false },
            }),
            truePeak: truePeakGuard({
                samplePeakDbfs: -1,
                truePeakDbtp: -1 + unifiedQuality.clippingRisk,
                targetDbtp: -1,
            }),
            codecCritic: codecRoundTripCritic({
                truePeakDelta: unifiedQuality.clippingRisk,
                transientSmearing: unifiedQuality.stretchArtifacts,
                preEcho: 0,
                spectralChange: unifiedQuality.spectralCollision,
                stereoImageChange: stemComputeProvenanceV2.spatialIntegrity.allowed ? 0 : 0.5,
                bassPhaseError: unifiedQuality.phaseRisk,
            }),
            renderRobustness: immersiveRenderRobustness({
                stereo: 1 - unifiedQuality.totalRisk,
                binaural: stemComputeProvenanceV2.spatialIntegrity.quality,
                speakers: qualityGuardianV3.monoSafety.safe ? 0.9 : 0.5,
            }),
            binauralQuality: binauralQuality({
                externalization: 0.5,
                localizationStability: stemComputeProvenanceV2.spatialIntegrity.quality,
                spectralNaturalness: 1 - unifiedQuality.spectralCollision,
                frontBackConfusionRisk: 0.3,
                spatialIntegrity: stemComputeProvenanceV2.spatialIntegrity.quality,
            }),
            stemPolicy: spatialStemPolicy({
                provenance: "unknown",
                spatialAwareMssQuality: stemComputeProvenanceV2.spatialIntegrity.quality,
                nativeObjectsAvailable: false,
            }),
            safeMode: spatialSafeMode({ nativeSpatial: false, generatedQuality: 0, creativeMode: false }),
        };
        const stretchSection = next.vocalness >= 0.6 ? "vocals" : next.danceability >= 0.7 ? "drums" : "ambient";
        const realtimeDspRouteV3: DirectorRealtimeDspRouteV3 = {
            stretchTier: stretchQualityTier({ realtime: true, cpuHeadroom: 0.6, preview: false }),
            stretchMaterial: sectionAdaptiveStretch(stretchSection),
            stretchBackend: routeDspBackend({
                type: "stretch",
                realtime: true,
                platform: "other",
                openImmersive: false,
                quality: "hq",
            }),
            resampleBackend: routeDspBackend({
                type: "resample",
                realtime: true,
                platform: "other",
                openImmersive: false,
                quality: "fast",
            }),
            spatialBackend: routeDspBackend({
                type: "spatial",
                realtime: true,
                platform: "other",
                openImmersive: true,
                quality: "hq",
            }),
            route: negotiateRoute(48_000, {
                hardwareRate: 48_000,
                channels: 2,
                latencyMs: 20,
                deviceId: "default-output",
            }),
            prewarm: DSP_PREWARM,
            routeStates: ROUTE_CHANGE_STATES_V2,
            rendererChange: rendererChange({
                experience: experience.resolved,
                energy: session.currentEnergy,
                journeyTarget: session.phase,
                currentTrack: current.trackId,
                from: "stereo",
                to: "stereo",
            }),
            capabilities: capabilityMatrix(
                providerInnovation.capabilities.rawAudio ? "local-flac" : "provider-playback",
            ),
        };
        const integritySamples = [current.energy, next.energy, compatibility.total];
        const dspProcessing = !processingRequested
            ? "none"
            : plan.type === "acapella"
              ? "stems"
              : plan.tempoRatio !== 1
                ? "hq-stretch"
                : plan.eqSweep
                  ? "eq-dj"
                  : "gain-crossfade";
        const audioIntegrityQoeV1: DirectorAudioIntegrityQoeV1 = {
            cache: losslessCacheStrategy({
                durationSec: next.durationSec ?? 0,
                channels: 2,
                sampleRate: 48_000,
                lookaheadBars: 32,
            }),
            masterHash: masterIntegrityHash(integritySamples),
            pcmIntegrity: pcmIntegrityTest(integritySamples, integritySamples),
            nullTest: dspNullTest(integritySamples, integritySamples),
            codecBenchmark: codecRoundTripBenchmark([
                {
                    codec: "opus",
                    delaySamples: 0,
                    paddingSamples: 0,
                    loudnessDelta: 0,
                    truePeakDelta: unifiedQuality.clippingRisk,
                    transientError: unifiedQuality.stretchArtifacts,
                    spectralDifference: unifiedQuality.spectralCollision,
                },
            ]),
            renderBenchmark: renderMatrixBenchmark([
                {
                    renderer: "stereo",
                    roleBalance: 1 - unifiedQuality.vocalCollision,
                    loudness: 1 - unifiedQuality.loudnessDiscontinuity,
                    localization: stemComputeProvenanceV2.spatialIntegrity.quality,
                    bass: 1 - unifiedQuality.phaseRisk,
                    foregroundClarity: 1 - unifiedQuality.spectralCollision,
                    transitionIntegrity: 1 - unifiedQuality.totalRisk,
                },
                {
                    renderer: "binaural",
                    roleBalance: 1 - unifiedQuality.vocalCollision,
                    loudness: 1 - unifiedQuality.loudnessDiscontinuity,
                    localization: immersiveRenderingV1.binauralQuality,
                    bass: 1 - unifiedQuality.phaseRisk,
                    foregroundClarity: 1 - unifiedQuality.spectralCollision,
                    transitionIntegrity: immersiveRenderingV1.renderRobustness.score,
                },
            ]),
            spatialHandoff: spatialHandoffPolicy(
                {
                    role: "foreground",
                    outgoingPosition: [0, 0, 1],
                    incomingPosition: [0, 0, 1],
                    widthCurve: [0.5, 0.5],
                    distanceCurve: [1, 1],
                },
                "transition",
            ),
            collision: immersiveCollision({
                frequencyOverlap: perceptualMasking.spectralCongestion,
                foregroundOverlap: perceptualMasking.vocalCollision,
                spatialDistance: 0.5,
                roleConflict: unifiedQuality.vocalCollision,
            }),
            dspTier: minimumDspTier({ processing: dspProcessing }),
            deliveryQoe: codecAwareQoe({
                bandwidthKbps: 320,
                losslessRequiredKbps: 1_000,
                currentTier: nativeSource.lossless ? "lossless" : "high-quality-lossy",
            }),
            hierarchy: BEATCORD_QUALITY_HIERARCHY,
        };
        const fidelityChainStage = {
            format: "float-pcm",
            sampleRate: 48_000,
            bitDepth: 24,
            lossless: true,
            verified: true,
        };
        const transformContract = {
            preservesSamples: !processingRequested,
            preservesTiming: true,
            preservesMetadata: ["codec-delay", "gapless", "channel-layout", "loudness", "source-provenance"] as const,
            preservesSpatialScene: immersiveRenderingV1.stemPolicy.action === "use-native-objects",
            introducesLoss: audioIntegrityQoeV1.deliveryQoe.deliveryTier !== "lossless",
        };
        const transformFidelityLedgerV2: DirectorTransformFidelityLedgerV2 = {
            ac4: AC4_RESEARCH_POLICY,
            metadata: metadataPreservationTest(
                { ...transformContract, preservesMetadata: [...transformContract.preservesMetadata] },
                ["codec-delay", "gapless", "channel-layout", "loudness", "source-provenance"],
            ),
            ledger: sourceFidelityLedger({
                sourceHash: audioIntegrityQoeV1.masterHash,
                transformations: [
                    {
                        operation: processingRequested ? "adaptive-transition" : "identity-playback",
                        contract: { ...transformContract, preservesMetadata: [...transformContract.preservesMetadata] },
                    },
                ],
                outputFormat: audioIntegrityQoeV1.deliveryQoe.deliveryTier,
                reversible: !transformContract.introducesLoss,
            }),
            postRendererCritic: postRendererTransitionCritic({
                pcmQuality: 1 - unifiedQuality.totalRisk,
                codecQuality: immersiveRenderingV1.codecCritic.score,
                rendererQuality: immersiveRenderingV1.renderRobustness.score,
                deviceTwinQuality: playbackTwinCausalLedgerV2.confidence,
                divergence: {
                    loudness: unifiedQuality.loudnessDiscontinuity,
                    balance: unifiedQuality.spectralCollision,
                    spatialPosition: 1 - stemComputeProvenanceV2.spatialIntegrity.quality,
                    transitionTiming: unifiedQuality.rhythmicMismatch,
                },
            }),
            automation: renderSpecificAutomation({ renderer: "speaker", baseWidth: 0.5, baseOverlapSec: plan.fadeSec }),
            portableTransition: {
                roles: [
                    { role: "ambience", ownership: "shared", timing: 0, spatialIntent: "wide" },
                    { role: "rhythm", ownership: "incoming", timing: plan.fadeSec * 0.5, spatialIntent: "front" },
                    { role: "foreground", ownership: "incoming", timing: plan.fadeSec, spatialIntent: "front" },
                ],
                bakedChannels: false,
                formatNeutral: true,
            },
            dependency: dependencyCapability(
                {
                    name: "rubberband",
                    license: "commercial",
                    commercialAllowed: true,
                    attributionRequired: false,
                    platformSupport: ["mac", "linux"],
                },
                "mac",
                true,
            ),
            stretchRoute: stretchRoute(plan.tempoRatio),
            artifactRepair: artifactRepair(unifiedQuality.stretchArtifacts > 0.5 ? "transient-smear" : "clipping"),
            resampling: resamplingGraph([
                {
                    inputRate: nativeSource.sampleRate,
                    outputRate: dspPrecisionGaplessPolicy.sampleRate.workingRate,
                    reason: "engine",
                    backend: realtimeDspRouteV3.resampleBackend,
                },
            ]),
            fidelity: fidelityStatus({
                source: {
                    format: nativeSource.lossless ? "flac" : "provider-audio",
                    sampleRate: nativeSource.sampleRate,
                    bitDepth: nativeSource.bitDepth,
                    lossless: nativeSource.lossless,
                    verified: nativeSource.nativeResolutionKnown,
                },
                decode: fidelityChainStage,
                dsp: { ...fidelityChainStage, lossless: !processingRequested },
                transport: {
                    ...fidelityChainStage,
                    format: audioIntegrityQoeV1.deliveryQoe.deliveryTier,
                    lossless: audioIntegrityQoeV1.deliveryQoe.deliveryTier === "lossless",
                },
                output: {
                    ...fidelityChainStage,
                    format: "speaker",
                    lossless: dspPrecisionGaplessPolicy.bitPerfect.verified,
                    verified: true,
                },
            }),
            routeMatrix: AUDIO_ROUTE_TEST_MATRIX_V2,
        };
        const fidelityExperience = experience.resolved === "party" ? "party" : "pure";
        const sceneRoles = [
            { role: "ambience" as const, location: "wide" as const, foreground: false },
            { role: "percussion" as const, location: "front" as const, foreground: true },
            { role: "vocal" as const, location: "front" as const, foreground: true },
        ];
        const fidelitySpatialV1: DirectorFidelitySpatialV1 = {
            utility: fidelityAwareUtility({
                experience: fidelityExperience,
                experienceQuality: compatibility.experience,
                fidelityPreservation: 1 - transformFidelityLedgerV2.postRendererCritic.finalRisk,
                manipulationCost: hierarchicalStemMixing.manipulationCost,
            }),
            artisticIntegrity: spatialArtisticIntegrity({
                nativeScene: false,
                creativeMode: false,
                transitionBoundary: true,
                selectedSafeRole: true,
            }),
            nativeTransition: nativeSpatialTransition({
                outgoingNativeObjects: false,
                incomingNativeObjects: false,
            }),
            roleMatch: matchSceneRoles(sceneRoles, sceneRoles),
            collision: spatialSceneCollision({
                foregroundObjects: 2,
                sameLocationPairs: perceptualMasking.vocalCollision > 0.5 ? 1 : 0,
                heightClutter: 0,
                rearOverload: 0,
                centerMasking: perceptualMasking.spectralCongestion,
            }),
            downmix: spatialDownmixCritic({
                roleBalance: 1 - unifiedQuality.vocalCollision,
                foregroundClarity: 1 - unifiedQuality.spectralCollision,
                bassIntegrity: 1 - unifiedQuality.phaseRisk,
                transitionIntegrity: 1 - unifiedQuality.totalRisk,
            }),
            openPrototype: OPEN_IMMERSIVE_PROTOTYPE,
            experiments: AUDIO_RESEARCH_EXPERIMENTS_V2,
            evidenceRule: evidenceUse("official-spec"),
            backendStrategy: FORMAT_BACKEND_STRATEGY,
        };
        const audioFidelitySuiteV4: DirectorAudioFidelitySuiteV4 = {
            architecture: AUDIO_ARCHITECTURE_V4,
            independence: CODEC_SPATIAL_INDEPENDENCE,
            phases: AUDIO_IMPLEMENTATION_PHASES_V4,
            suite: AUDIO_FIDELITY_SUITE_V4,
            currentBenchmark: fidelityBenchResult("codec-roundtrip", [
                immersiveRenderingV1.codecCritic.score,
                immersiveRenderingV1.renderRobustness.score,
                1 - unifiedQuality.totalRisk,
            ]),
            guardian: qualityGuardianV4({
                canBypass: dspPrecisionGaplessPolicy.bitPerfect.verified,
                requiredProcessingTier: audioIntegrityQoeV1.dspTier.tier,
                deliveryValidation: 1 - transformFidelityLedgerV2.postRendererCritic.finalRisk,
            }),
            priorities: AUDIO_RESEARCH_PRIORITY_V4,
        };
        const presentationRequirements = contextRequirements("local-headphones");
        const localTransport = {
            name: "local-pcm",
            codecs: ["pcm"],
            latencyRangeMs: [2, 20] as [number, number],
            packetLossRecovery: [],
            maxChannels: 8,
            supportsBroadcast: false,
            supportsBidirectional: false,
            supportsTimedMetadata: true,
            maturity: "production" as const,
        };
        const presentationTransportV1: DirectorPresentationTransportV1 = {
            requirements: presentationRequirements,
            compilation: compilePresentation(presentationRequirements, [localTransport]),
            score: transportScore({
                quality: 1,
                reliability: 1,
                syncPrecision: 1,
                batteryEfficiency: 0.7,
                latency: 0.1,
                bandwidthCost: 0.5,
                failureRisk: 0.1,
            }),
            leAudio: LE_AUDIO_BASELINE,
            auracast: auracastArchitecture({ listeners: 1, controlClients: 1 }),
            planes: CONTROL_AUDIO_PLANE_ARCHITECTURE,
            lc3plus: lc3plusPolicy({
                baselineLeAudio: false,
                lc3plusNegotiated: false,
                losslessProfileNegotiated: false,
            }),
            wireless: wirelessCapability({
                codec: "unknown",
                sampleRate: 48_000,
                lossless: false,
                confidence: 0,
            }),
            opus: opusRemotePolicy({ opusVersion: "1.6", inputRate: 48_000, testsShowHdValue: false }),
        };
        const runtimeEvidence = this.runtimeEvidence;
        const networkEvidence = runtimeEvidence.network;
        const observedNetwork = networkEvidence.reports > 0;
        const syncReport = {
            clockOffsetMs: networkEvidence.meanClockOffsetMs,
            bufferMs: observedNetwork ? networkEvidence.meanBufferMs : 40,
            playoutDriftMs: networkEvidence.meanPlayoutDriftMs,
            lateObjects: networkEvidence.lateObjects,
        };
        const networkQuality = observedNetwork
            ? Math.max(
                  0,
                  1 -
                      Math.min(
                          1,
                          networkEvidence.meanPacketLossRate * 5 +
                              networkEvidence.meanPlayoutDriftMs / 250 +
                              networkEvidence.lateObjects / Math.max(10, networkEvidence.reports * 10),
                      ),
              )
            : 1;
        const endpointLatency = {
            decodeMs: 4,
            renderMs: 3,
            deviceMs: 10,
            transportMs: observedNetwork ? Math.max(2, networkEvidence.meanClockOffsetMs) : 2,
            confidence: observedNetwork ? Math.min(1, networkEvidence.reports / 10) : 0.95,
        };
        const deadlineTransportV2: DirectorDeadlineTransportV2 = {
            recovery: choosePacketRecovery({
                retransmissionEtaMs: 18,
                timeUntilPlayoutMs: syncReport.bufferMs,
                fecAvailable: networkEvidence.meanPacketLossRate > 0,
                dredAvailable: false,
                dredMaturity: "watch",
            }),
            protection: momentAwareProtection({
                importance: Math.max(compatibility.experience, 1 - unifiedQuality.totalRisk),
                startTime: currentTraits.durationMs,
                durationMs: plan.fadeSec * 1_000,
            }),
            scheduledMoment: scheduleMediaObject({
                id: `${current.trackId}:${next.trackId}:handoff`,
                kind: "audio",
                presentationTime: currentTraits.durationMs,
                priority: 10,
                payloadRef: `transition:${plan.type}`,
                endpoint: endpointLatency,
                transitionCritical: true,
            }),
            resynchronization: beatSafeResynchronization(syncReport),
            program: compilePresentationProgram({
                compute: {
                    device: "mac-m",
                    batteryLevel: 1,
                    thermalPressure: 0,
                    cachedStems: options.stemsReady,
                },
                networkQuality,
                syncReport,
                localMaster: true,
            }),
            safeRecovery: transportRecoveryPolicy({
                staleObjects: [],
                nextSafeBoundaryTime: currentTraits.durationMs,
            }),
            sessionFabric: SESSION_FABRIC_V2,
            benchmarks: TRANSPORT_BENCHMARK_SUITE_V2,
        };
        const platformEvidenceRealtimeV1: DirectorPlatformEvidenceRealtimeV1 = {
            creatorPermission: creatorPermission({
                envelope: {
                    role: "vocal",
                    gainRangeDb: [-1.5, 1.5],
                    muteAllowed: false,
                    stemMixAllowed: true,
                    transitionManipulationAllowed: true,
                    preferredPreservation: 1,
                },
                operation: "gain",
                gainDb: 0,
            }),
            analysisRequest: appleAnalysisRequest({ kinds: ["beats", "bars", "phrases", "sections", "key", "pace"] }),
            evidenceFusion: fuseMusicalEvidence([
                {
                    provider: "beatcord",
                    kind: "beats",
                    confidence: compatibility.beat,
                    values: [current.bpm],
                    native: false,
                },
                ...runtimeEvidence.providerEvidence.filter((evidence) => evidence.kind === "beats"),
            ]),
            modelAdmission: admitRealtimeModel({
                profile: {
                    worstCaseMicros: 120,
                    memoryBytes: 65_536,
                    modelVersion: "transient-verifier-v1",
                    deadlineClass: "audio-callback",
                    fallback: "deterministic-transient-detector",
                    preallocated: true,
                    boundedShapes: true,
                    performsIo: false,
                },
                otherDspMicros: 300,
                bufferDeadlineMicros: 2_000,
                safetyMargin: 0.7,
            }),
            telemetry: deadlineTelemetry([110, 120, 130, 150], 2_000),
            topology: APPLE_REALTIME_TOPOLOGY_V1,
            benchmark: MUSIC_UNDERSTANDING_BENCH_V1,
        };
        const transitionValidationLabV4: DirectorTransitionValidationLabV4 = {
            critic: transitionCriticV4({
                loudnessControl: 1 - unifiedQuality.loudnessDiscontinuity,
                spectralCollision: unifiedQuality.spectralCollision,
                spectralContinuity: 1 - unifiedQuality.totalRisk,
                trajectorySmoothness: compatibility.energy,
                stereoStability: 1 - unifiedQuality.phaseRisk,
                beatConsistency: compatibility.beat,
                musicalPhrasing: compatibility.phrase,
                journeyFit: compatibility.experience,
            }),
            preferences: preferenceGraph([]),
            mixPointPrior: mixPointPrior({
                structuralMatch: compatibility.phrase,
                genreMatch: compatibility.genre,
                energyMatch: compatibility.energy,
                roleMatch: 1 - perceptualMasking.vocalCollision,
            }),
            shipGate: transitionLabShipGate({
                pairwisePreferenceGain: 0,
                catastrophicRejectionGain: 0,
                naturalnessGain: 0,
                journeyFitGain: 0,
                computeRegression: 0,
                latencyRegression: 0,
                reliabilityRegression: 0,
            }),
            program: TRANSITION_LAB_V4,
        };
        const beatMeshFailures = {
            octaveErrorRate: 0,
            continuityFailureRate: 0,
            catastrophicFailureRate: 0,
            downbeatPhaseError: beatgridV2.phase.phaseDriftMsPerSec / 1_000,
            meterError: 0,
            tempoDrift: beatgridV2.phase.phaseDriftMsPerSec / 1_000,
            highConfidenceWrongRate: 0,
        };
        const safetyGain = transitionSafetyGain({ badTransitionsAvoided: 1, badTransitionsIntroduced: 0 });
        const complexityRoi = beatMeshComplexityRoi({
            transitionQualityImprovement: compatibility.beat,
            additionalCompute: 0.25,
            additionalComplexity: 0.25,
        });
        const beatMeshValidationV3: DirectorBeatMeshValidationV3 = {
            safetyGain,
            complexityRoi,
            deployment: beatMeshDeploymentDecision({
                affectedCatalogRate: 0.2,
                safetyGain,
                roi: complexityRoi,
                failures: beatMeshFailures,
            }),
            failureClasses: BEAT_MESH_FAILURE_CLASSES_V3,
            program: BEAT_MESH_VALIDATION_V3,
        };
        const { beatMeshTortureLabV1, stemTransitionUtilityV1, longitudinalTasteLabV1, humanInterventionLabV1 } =
            compileValidationRuntimeV1({
                currentTrackId: current.trackId,
                nextTrackId: next.trackId,
                transitionType: plan.type,
                fadeSec: plan.fadeSec,
                stemsReady: options.stemsReady,
                beat: {
                    compatibility: compatibility.beat,
                    bpmConfidence: current.bpmConfidence,
                    rhythmicMismatch: unifiedQuality.rhythmicMismatch,
                    phraseCompatibility: compatibility.phrase,
                },
                stem: {
                    quality: stemSequential.quality,
                    artifactSalience: unifiedQuality.stemArtifacts,
                    stretchArtifacts: unifiedQuality.stretchArtifacts,
                    spectralCollision: unifiedQuality.spectralCollision,
                    vocalCollision: unifiedQuality.vocalCollision,
                    spatialQuality: fidelitySpatialV1.downmix.quality,
                    spatialCollisionRisk: fidelitySpatialV1.collision.risk,
                    maskingRisk: perceptualMasking.risk,
                    postRendererRisk: transformFidelityLedgerV2.postRendererCritic.finalRisk,
                    manipulationCost: hierarchicalStemMixing.manipulationCost,
                    totalQualityRisk: unifiedQuality.totalRisk,
                },
                taste: {
                    profileDrift: runtimeEvidence.profile.profileDrift,
                    userConfirmedChange: runtimeEvidence.profile.userConfirmedChange,
                    profileIdentification: runtimeEvidence.profile.profileIdentification,
                },
                intervention: {
                    experience: experience.resolved === "party" ? "party" : "other",
                    experienceImprovement: compatibility.experience,
                    decisionConfidence: confidence,
                    currentSongValue: current.energy,
                    upcomingPayoff: tension.sections.at(-1)?.tension ?? 0,
                    userSelected: false,
                    albumIntegrity: continuityPolicy.disableCrossfade ? 1 : 0,
                    currentFlow: journey.currentEnergy,
                    targetEnergy: journey.targetEnergy,
                    surpriseUsed: surpriseBudget.used,
                    candidates: candidateScores.map((candidate) => ({
                        id: candidate.type,
                        plannerScore: candidate.plannerScore,
                        directorScore: candidate.directorScore ?? candidate.plannerScore,
                    })),
                },
                runtimeEvidence,
            });
        const timestamp = this.#now();
        const inputStateHash = hashDirectorInput({
            policyVersion: DIRECTOR_VERSION,
            capabilities: this.#capabilities,
            learningSessionMode: this.#learningSessionMode,
            currentTraits,
            nextTraits,
            current,
            next,
            lookahead,
            options: {
                fadeSec: options.fadeSec,
                tempoSync: options.tempoSync,
                eqSweep: options.eqSweep,
                harmonic: options.harmonic,
                stemsReady: options.stemsReady,
                outgoingTempoRatio: options.outgoingTempoRatio,
                maxFadeSec,
                stretcherProfile: options.stretcherProfile ?? "rubberband",
                highQualityStretch: options.highQualityStretch ?? false,
                feedback: options.feedback ?? null,
            },
            experience,
            session,
            journey,
            communityPriorities,
            architecture,
            research,
            principles,
            researchLandscape: SECOND_DEPTH_RESEARCH,
            performanceStyle,
            progressivePlan,
            musicalIntelligence,
            vision,
            journeyTemplate,
            familiarity,
            surpriseBudget,
            strategyFatigue,
            tension,
            loopability,
            emergencyContinuity,
            backtiming,
            continuityPolicy,
            policyDecision,
            unifiedQuality,
            advancedExperience,
            whyThis,
            intelligenceBoundary,
            groupRules,
            recommendationV2,
            affect,
            crowdGovernance,
            recommendationGovernance,
            researchGovernance,
            materialIntelligence,
            grooveCrowdIntelligence,
            exposureContext,
            performancePolicy,
            beatgridV2,
            clubV3,
            realtimeReliability,
            psychoacousticCritic,
            transitionCriticV2,
            conversationPolicy,
            tastePrivacy,
            qualityGuardianV3,
            evaluationReliabilityV2,
            semanticIntelligence,
            safeListening,
            distributedRecovery,
            rightsPlanning,
            temporalAgent,
            stemSequential,
            provenanceSignal,
            momentCompute,
            artistEcosystem,
            artistAnalytics,
            artistGovernance,
            sessionContinuity,
            crossProviderIdentity,
            socialSession,
            experienceIntegration,
            mobilityKaraokeMemory,
            socialPrivacyUx,
            integrationSdkAccessibility,
            platformResilience,
            contextSerendipityTrust,
            qualityOfExperience,
            experienceQoeGovernance,
            providerInnovation,
            validatedInnovations,
            productStrategy,
            businessValidation,
            adaptiveBeatMesh,
            hierarchicalStemMixing,
            robustTransitionFunnel,
            analyzerKnowledge,
            musicalCompiler,
            perceptualPlayback,
            causalTaste,
            explorationUncertaintyTeaching,
            stemComputeProvenanceV2,
            multisensoryAttentionExperience,
            playbackTwinCausalLedgerV2,
            causalDecisionConfidenceV3,
            semanticListeningV1,
            activeBeatMeshV2,
            audioSourceResolutionPolicy,
            dspPrecisionGaplessPolicy,
            immersiveRenderingV1,
            realtimeDspRouteV3,
            audioIntegrityQoeV1,
            transformFidelityLedgerV2,
            fidelitySpatialV1,
            audioFidelitySuiteV4,
            presentationTransportV1,
            deadlineTransportV2,
            platformEvidenceRealtimeV1,
            transitionValidationLabV4,
            beatMeshValidationV3,
            beatMeshTortureLabV1,
            stemTransitionUtilityV1,
            longitudinalTasteLabV1,
            humanInterventionLabV1,
            runtimeEvidence,
            taste: this.#taste,
            override: activeOverride,
        });
        const seed = Number.parseInt(inputStateHash.slice(-8), 16) >>> 0;
        const decision: DirectorDecisionLog = {
            version: 1,
            id: `${timestamp}-${inputStateHash}`,
            timestamp,
            inputStateHash,
            fromTrackId: current.trackId,
            toTrackId: next.trackId,
            candidateScores,
            selectedPlan: { ...plan },
            experience: experience.requested,
            experienceResolved: experience.resolved,
            sessionPhase: session.phase,
            journey,
            communityPriorities,
            architecture,
            research,
            principles,
            researchLandscape: SECOND_DEPTH_RESEARCH,
            performanceStyle,
            progressivePlan,
            musicalIntelligence,
            vision,
            journeyTemplate,
            familiarity,
            surpriseBudget,
            strategyFatigue,
            tension,
            loopability,
            emergencyContinuity,
            backtiming,
            continuityPolicy,
            policyDecision,
            unifiedQuality,
            advancedExperience,
            whyThis,
            intelligenceBoundary,
            learningSessionMode: this.#learningSessionMode,
            groupRules,
            recommendationV2,
            affect,
            crowdGovernance,
            recommendationGovernance,
            researchGovernance,
            materialIntelligence,
            grooveCrowdIntelligence,
            exposureContext,
            performancePolicy,
            beatgridV2,
            clubV3,
            realtimeReliability,
            psychoacousticCritic,
            transitionCriticV2,
            conversationPolicy,
            tastePrivacy,
            qualityGuardianV3,
            evaluationReliabilityV2,
            semanticIntelligence,
            safeListening,
            distributedRecovery,
            rightsPlanning,
            temporalAgent,
            stemSequential,
            provenanceSignal,
            momentCompute,
            artistEcosystem,
            artistAnalytics,
            artistGovernance,
            sessionContinuity,
            crossProviderIdentity,
            socialSession,
            experienceIntegration,
            mobilityKaraokeMemory,
            socialPrivacyUx,
            integrationSdkAccessibility,
            platformResilience,
            contextSerendipityTrust,
            qualityOfExperience,
            experienceQoeGovernance,
            providerInnovation,
            validatedInnovations,
            productStrategy,
            businessValidation,
            adaptiveBeatMesh,
            hierarchicalStemMixing,
            robustTransitionFunnel,
            analyzerKnowledge,
            musicalCompiler,
            perceptualPlayback,
            causalTaste,
            explorationUncertaintyTeaching,
            stemComputeProvenanceV2,
            multisensoryAttentionExperience,
            playbackTwinCausalLedgerV2,
            causalDecisionConfidenceV3,
            semanticListeningV1,
            activeBeatMeshV2,
            audioSourceResolutionPolicy,
            dspPrecisionGaplessPolicy,
            immersiveRenderingV1,
            realtimeDspRouteV3,
            audioIntegrityQoeV1,
            transformFidelityLedgerV2,
            fidelitySpatialV1,
            audioFidelitySuiteV4,
            presentationTransportV1,
            deadlineTransportV2,
            platformEvidenceRealtimeV1,
            transitionValidationLabV4,
            beatMeshValidationV3,
            beatMeshTortureLabV1,
            stemTransitionUtilityV1,
            longitudinalTasteLabV1,
            humanInterventionLabV1,
            runtimeEvidence,
            analyzerVersions: { ...ANALYZER_VERSIONS },
            directorVersion: DIRECTOR_VERSION,
            seed,
            shadow,
            perceptualMasking,
            stretchDecision,
            ...(regionSelection ? { regionSelection } : {}),
            compatibility,
            compatibilityRoute,
            fatigue,
            noveltyBudget,
            ...(overrideAudit ? { override: overrideAudit } : {}),
        };
        this.#memory.transitionHistory = limit(
            [
                ...this.#memory.transitionHistory,
                {
                    atMs: timestamp,
                    fromTrackId: current.trackId,
                    toTrackId: next.trackId,
                    type: plan.type,
                    confidence,
                },
            ],
            40,
        );
        this.#notifySnapshotChanged();
        return {
            plan,
            cue,
            preRollSec,
            intent,
            experience,
            session,
            journey,
            communityPriorities,
            architecture,
            research,
            principles,
            researchLandscape: SECOND_DEPTH_RESEARCH,
            performanceStyle,
            progressivePlan,
            musicalIntelligence,
            vision,
            journeyTemplate,
            familiarity,
            surpriseBudget,
            strategyFatigue,
            tension,
            loopability,
            emergencyContinuity,
            backtiming,
            continuityPolicy,
            policyDecision,
            unifiedQuality,
            advancedExperience,
            whyThis,
            intelligenceBoundary,
            learningSessionMode: this.#learningSessionMode,
            groupRules,
            recommendationV2,
            affect,
            crowdGovernance,
            recommendationGovernance,
            researchGovernance,
            materialIntelligence,
            grooveCrowdIntelligence,
            exposureContext,
            performancePolicy,
            beatgridV2,
            clubV3,
            realtimeReliability,
            psychoacousticCritic,
            transitionCriticV2,
            conversationPolicy,
            tastePrivacy,
            qualityGuardianV3,
            evaluationReliabilityV2,
            semanticIntelligence,
            safeListening,
            distributedRecovery,
            rightsPlanning,
            temporalAgent,
            stemSequential,
            provenanceSignal,
            momentCompute,
            artistEcosystem,
            artistAnalytics,
            artistGovernance,
            sessionContinuity,
            crossProviderIdentity,
            socialSession,
            experienceIntegration,
            mobilityKaraokeMemory,
            socialPrivacyUx,
            integrationSdkAccessibility,
            platformResilience,
            contextSerendipityTrust,
            qualityOfExperience,
            experienceQoeGovernance,
            providerInnovation,
            validatedInnovations,
            productStrategy,
            businessValidation,
            adaptiveBeatMesh,
            hierarchicalStemMixing,
            robustTransitionFunnel,
            analyzerKnowledge,
            musicalCompiler,
            perceptualPlayback,
            causalTaste,
            explorationUncertaintyTeaching,
            stemComputeProvenanceV2,
            multisensoryAttentionExperience,
            playbackTwinCausalLedgerV2,
            causalDecisionConfidenceV3,
            semanticListeningV1,
            activeBeatMeshV2,
            audioSourceResolutionPolicy,
            dspPrecisionGaplessPolicy,
            immersiveRenderingV1,
            realtimeDspRouteV3,
            audioIntegrityQoeV1,
            transformFidelityLedgerV2,
            fidelitySpatialV1,
            audioFidelitySuiteV4,
            presentationTransportV1,
            deadlineTransportV2,
            platformEvidenceRealtimeV1,
            transitionValidationLabV4,
            beatMeshValidationV3,
            beatMeshTortureLabV1,
            stemTransitionUtilityV1,
            longitudinalTasteLabV1,
            humanInterventionLabV1,
            runtimeEvidence,
            manipulationBudget: roundedBudget,
            reasoning: {
                selected: plan.type,
                reasons,
                rejected: rejected.slice(0, 6),
                safetyFallback,
            },
            perceptualMasking,
            stretchDecision,
            regionSelection,
            compatibility,
            compatibilityRoute,
            fatigue,
            noveltyBudget,
            override: overrideAudit,
            decision,
        };
    }

    #resolveExperience(profiles: readonly TrackProfile[]): ExperienceSelection {
        let selection: ExperienceSelection;
        let auto: boolean;
        if (this.#requested !== "auto") {
            selection = selectExperience(this.#requested, this.#intensity, this.#blend);
            auto = false;
        } else {
            if (profiles.length) {
                const detected = detectExperience(profiles);
                if (this.#lastAuto && detected.resolved !== this.#lastAuto.resolved) {
                    const lead = detected.weights[detected.resolved] - detected.weights[this.#lastAuto.resolved];
                    if (lead < 0.12 || detected.confidence < 0.58) {
                        selection = {
                            ...this.#lastAuto,
                            reason: `${this.#lastAuto.reason}; Auto hysteresis held ${this.#lastAuto.resolved}`,
                        };
                    } else {
                        this.#lastAuto = detected;
                        selection = detected;
                    }
                } else {
                    this.#lastAuto = detected;
                    selection = detected;
                }
            } else {
                selection = this.#lastAuto ?? detectExperience([]);
            }
            auto = true;
        }
        const target = this.#applyReplayStyle(this.#applyTaste(selection, auto));
        if (!this.#evolution) return target;
        const elapsed = this.#now() - this.#evolution.startedAtMs;
        if (elapsed >= this.#evolution.durationMs) {
            this.#evolution = null;
            return target;
        }
        return interpolateExperiences(
            this.#evolution.from,
            target,
            elapsed / this.#evolution.durationMs,
            this.#evolution.durationMs / 1000,
        );
    }

    #applyTaste(selection: ExperienceSelection, auto: boolean): ExperienceSelection {
        if (this.#taste.confidence <= 0) return selection;
        // Explicit intent dominates learning. Auto may use most of the learned
        // signal; an explicit selection receives only a subtle personalization.
        const weight = this.#taste.confidence * (auto ? 0.65 : 0.12);
        const mix = (explicit: number, learned: number) => explicit * (1 - weight) + learned * weight;
        return {
            ...selection,
            reason: `${selection.reason}; personalized ${Math.round(weight * 100)}%`,
            vector: {
                ...selection.vector,
                transitionIntensity: mix(selection.vector.transitionIntensity, this.#taste.transitionIntensity),
                preserveSongStructure: mix(selection.vector.preserveSongStructure, this.#taste.originalPreservation),
                vocalOverlapTolerance: mix(selection.vector.vocalOverlapTolerance, this.#taste.vocalOverlap),
                tempoManipulation: mix(selection.vector.tempoManipulation, this.#taste.tempoTolerance / 0.08),
                dynamicVariation: mix(selection.vector.dynamicVariation, this.#taste.energyVariance),
            },
        };
    }

    #applyReplayStyle(selection: ExperienceSelection): ExperienceSelection {
        if (!this.#replay) return selection;
        const mixPersonality = this.#replay.fingerprint.mixPersonality;
        const weight = 0.75;
        const mix = (current: number, replayed: number) => current * (1 - weight) + replayed * weight;
        return {
            ...selection,
            reason: `${selection.reason}; replaying session fingerprint`,
            vector: {
                ...selection.vector,
                transitionIntensity: mix(selection.vector.transitionIntensity, mixPersonality.transitionIntensity),
                preserveSongStructure: mix(selection.vector.preserveSongStructure, mixPersonality.originalPreservation),
                vocalOverlapTolerance: mix(selection.vector.vocalOverlapTolerance, mixPersonality.vocalOverlap),
                tempoManipulation: mix(selection.vector.tempoManipulation, mixPersonality.tempoTolerance / 0.08),
                dynamicVariation: mix(selection.vector.dynamicVariation, mixPersonality.energyVariance),
            },
        };
    }

    #notifySnapshotChanged(): void {
        this.#snapshotListener?.(this.exportSnapshot());
    }
}
