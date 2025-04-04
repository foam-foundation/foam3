/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.crunch;

import foam.lang.*;
import foam.dao.AbstractSink;
import foam.dao.ArraySink;
import foam.dao.DAO;
import foam.dao.ProxySink;
import foam.dao.Sink;
import foam.mlang.predicate.Nary;
import foam.mlang.predicate.Predicate;
import foam.mlang.sink.GroupBy;
import foam.core.approval.Approvable;
import foam.core.approval.ApprovalRequest;
import foam.core.approval.CompositeApprovable;
import foam.core.auth.*;
import foam.core.crunch.UCJUpdateApprovable;
import foam.core.crunch.ui.PrerequisiteAwareWizardlet;
import foam.core.crunch.ui.WizardState;
import foam.core.dao.Operation;
import foam.core.logger.Logger;
import foam.core.COREService;
import foam.core.pm.PM;
import foam.core.session.Session;
import foam.util.Auth;
import java.lang.Exception;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicLong;
import static foam.mlang.MLang.*;
import static foam.core.auth.LifecycleState.ACTIVE;
import static foam.core.crunch.CapabilityJunctionStatus.*;


public class ServerCrunchService
  extends    ContextAwareSupport
  implements CrunchService, COREService
{
  public static String CACHE_KEY = "CrunchService.PrerequisiteCache";

  protected AtomicLong         cacheSequenceId_ = new AtomicLong(0);
  protected SessionCrunchCache anonymousCache_;

  @Override
  public void start() {
    anonymousCache_ = new SessionCrunchCache();

    var prerequisiteCapabilityJunctionDAO = ((DAO) getX().get("prerequisiteCapabilityJunctionDAO"));
    var userCapabilityJunctionDAO         = ((DAO) getX().get("userCapabilityJunctionDAO"));
    var sink                              = new Sink() {
      public void put(Object obj, Detachable sub) {
        // ???: could have a sequence id per capability to mimimize how
        //      much cache is invalidated
        cacheSequenceId_.getAndIncrement();
      }
      public void remove(Object obj, Detachable sub) {
        cacheSequenceId_.getAndIncrement();
      }
      public void reset(Detachable sub) {
        cacheSequenceId_.getAndIncrement();
      }
      public void eof() {};
    };

    prerequisiteCapabilityJunctionDAO.listen(sink, TRUE);
    userCapabilityJunctionDAO.listen(sink, TRUE);
  }

  public List getGrantPath(X x, String rootId) {
    return getCapabilityPath(x, rootId, true, true);
  }

  //TODO: Needs to be refactored once Subject is serializable
  public List getCapabilityPathFor(X x, String rootId, boolean filterGrantedUCJ, User effectiveUser, User user) {
    AuthService auth = (AuthService) x.get("auth");
    if ( auth.check(x, "service.crunchService.updateUserContext") ) {
      x = Auth.sudo(x, effectiveUser, user);
    }
    return this.getCapabilityPath(x, rootId, filterGrantedUCJ, true);
  }

  public List getCapabilityPath(X x, String rootId, boolean filterGrantedUCJ, boolean groupPrereqAwares) {
    return retrieveCapabilityPath(x, rootId, filterGrantedUCJ, groupPrereqAwares, null);
  }

  public List retrieveCapabilityPath(X x, String rootId, boolean filterGrantedUCJ, boolean groupPrereqAwares, List collectLeafNodesList) {
    Logger logger = (Logger) x.get("logger");
    PM pm = PM.create(x, this.getClass().getSimpleName(), "getCapabilityPath");

    DAO capabilityDAO = (DAO) x.get("capabilityDAO");

    // Lookup for indices of previously observed capabilities
    List<String> alreadyListed = new ArrayList<String>();

    // List of capabilities required to grant the desired capability.
    // Throughout the traversial algorithm this list starts with parents of
    // prerequisites appearing earlier in the list. Before returning, this
    // list is reversed so that the caller receives capabilities in order of
    // expected completion (i.e. pre-order traversial)
    List grantPath = new ArrayList<>();

    Queue<String> nextSources = new ArrayDeque<String>();
    nextSources.add(rootId);

    // Doing this instead of "this" could prevent unexpected behaviour
    // in the incident CrunchService's getJunction method is decorated
    CrunchService crunchService = (CrunchService) x.get("crunchService");

    while ( nextSources.size() > 0 ) {
      String sourceCapabilityId = nextSources.poll();

      if ( filterGrantedUCJ ) {
        UserCapabilityJunction ucj = getJunction(x, sourceCapabilityId);
        if ( ucj != null && ucj.getStatus() == CapabilityJunctionStatus.GRANTED
          && ! maybeReopen(x, ucj.getTargetId())
        ) {
          continue;
        }
      }

      if ( alreadyListed.contains(sourceCapabilityId) ) continue;

      // Add capability to grant path, and remember index in case it's replaced
      Capability cap = (Capability) capabilityDAO.find(sourceCapabilityId);

      // Skip missing capability
      if ( cap == null || cap.getLifecycleState() != foam.core.auth.LifecycleState.ACTIVE ) {
        continue;
      }
      alreadyListed.add(sourceCapabilityId);
      var prereqsList = getPrereqs(x, sourceCapabilityId, null);
      var prereqs = prereqsList == null ? new String[0] : prereqsList.stream()
          .filter(c -> ! alreadyListed.contains(c))
          .toArray(String[]::new);

      var prereqAware = cap.getWizardlet() instanceof PrerequisiteAwareWizardlet || (
        cap.getBeforeWizardlet() != null &&
        cap.getBeforeWizardlet() instanceof PrerequisiteAwareWizardlet
      );
      if ( groupPrereqAwares && prereqAware && ! rootId.equals(sourceCapabilityId) ) {
        List minMaxArray = new ArrayList<>();

        // Manually grab the direct  prereqs to the  MinMaxCapability
        for ( int i = prereqs.length - 1 ; i >= 0 ; i-- ) {
          var prereqGrantPath = this.getCapabilityPath(x, prereqs[i], filterGrantedUCJ, true);

          // remove prereqs that are already listed
          prereqGrantPath.removeIf(c -> {
            if (  c instanceof List ){
              return false;
            }
            return alreadyListed.contains(((Capability) c).getId());
          });

          // Essentially we reserve arrays to denote  ANDs and ORs, must be at least 2  elements
          if ( prereqGrantPath.size() > 1 ) minMaxArray.add(prereqGrantPath);
          else if ( prereqGrantPath.size() == 1 ) minMaxArray.add(prereqGrantPath.get(0));
        }

        /**
            Format of a min max for getGrantPath
            [[prereqsChoiceA, choiceA], [prereqsChoiceB,choiceB], minMaxCapa]
         */
        minMaxArray.add(cap);

        /**
            Format of a min max for getGrantPath as a prereq for another  capability
            [[[prereqsChoiceA, choiceA], [prereqsChoiceB,choiceB], minMaxCap],cap]
         */
        grantPath.add(minMaxArray);

        continue;
      }
      grantPath.add(cap);

      // Collect leaf nodes in the list
      if ( collectLeafNodesList != null ) {
        if ( prereqs == null || prereqs.length == 0 ) {
          collectLeafNodesList.add(cap);
        } else if ( filterGrantedUCJ ) {
          boolean foundOutstandingCapability = false;
          for (var capabilityId : prereqs ) {
            UserCapabilityJunction ucj = getJunction(x, capabilityId);
            if ( ucj == null || ucj.getStatus() != CapabilityJunctionStatus.GRANTED) {
              foundOutstandingCapability = true;
              break;
            }
          }
          // When there are no outstanding prerequisites, consider this a leaf node
          if (!foundOutstandingCapability) {
            collectLeafNodesList.add(cap);
          }
        }
      }

      // Enqueue prerequisites for adding to grant path
      for ( int i = prereqs.length - 1 ; i >= 0 ; i-- ) {
        nextSources.add(prereqs[i]);
      }
    }

    if ( collectLeafNodesList != null ) {
      Collections.reverse(collectLeafNodesList);
    }
    Collections.reverse(grantPath);
    pm.log(x);
    return grantPath;
  }

  // ???: Why does this return an array while getPrereqs returns a list?
  public String[] getDependentIds(X x, String capabilityId) {
    return getSessionCache(x).getDependents(x, cacheSequenceId_.get(), capabilityId);
  }

  // gets prereq list of a cap from the prereqsCache_
  // if cache returned is null, try to find prereqs directly from prerequisitecapabilityjunctiondao
  public List<String> getPrereqs(X x, String capId, UserCapabilityJunction ucj) {
    var auth = (AuthService) x.get("auth");
    if ( auth.check(x, "service.crunchService.updateUserContext") && ucj != null ) {
      Subject s = ucj.getSubject(x);
      x = Auth.sudo(x, s.getUser(), s.getRealUser());
    }

    var cache = getSessionCache(x);
    return cache.getPrerequisites(x, cacheSequenceId_.get(), capId);
  }

  public List<Capability> getPrereqObjects(X x, String capId) {
    var cache = getSessionCache(x);
    return cache.getPrerequisiteObjects(x, cacheSequenceId_.get(), capId);
  }

  public SessionCrunchCache getSessionCache(X x) {
    var  session = (Session) x.get(Session.class);
    User user    = ((Subject) x.get("subject")).getUser();

    if ( user == null || session == null ) return anonymousCache_;

    Long userId  = user.getId();
    Long agentId = ((Subject) x.get("subject")).getRealUser().getId();

    boolean cacheValid = session.getAgentId() > 0 ?
      session.getAgentId() == agentId && session.getUserId() == userId :
      session.getUserId()  == agentId && session.getUserId() == userId;

    if ( ! cacheValid ) return anonymousCache_;

    var cache = (SessionCrunchCache) session.getContext().get(CACHE_KEY);
    if ( cache == null && session.getApplyContext() != null ) {
      cache = new SessionCrunchCache();
      session.setApplyContext(session.getApplyContext().put(CACHE_KEY, cache));
    } else if ( cache == null ) {
      // Unsaved cache means no caching!
      cache = new SessionCrunchCache();
    }

    return cache;
  }

  // sets the prerequisite cache to null, is used when session info changes
  public static void purgeCache(X x) {
//    Session session = x.get(Session.class);
//    if ( session != null && session.getApplyContext() != null ) {
//      session.setApplyContext(session.getApplyContext().put(CACHE_KEY, null));
//    }
  }


  //TODO: Needs to be refactored once Subject is serializable
  public UserCapabilityJunction getJunctionFor(X x, String capabilityId, User effectiveUser, User user) {
    Subject s = new Subject(user);
    s.setUser(effectiveUser);
    // note the next function call does an auth check too see if the subject really should change
    return this.getJunctionForSubject(x, capabilityId, s);
  }

  public UserCapabilityJunction getJunction(X x, String capabilityId) {
    Subject subject = (Subject) x.get("subject");
    return this.getJunctionForSubject(x, capabilityId, subject);
  }

  public boolean atLeastOneInCategory(X x, String category) {
    var categoryJunctionDAO = (DAO) x.get("capabilityCategoryCapabilityJunctionDAO");

    var junctions = new ArrayList<>();
    categoryJunctionDAO.where(EQ(CapabilityCategoryCapabilityJunction.SOURCE_ID, category))
    .select(new AbstractSink() {
      @Override
      public void put(Object obj, Detachable sub) {
        junctions.add(((CapabilityCategoryCapabilityJunction) obj).getTargetId());
      }
    });

    var ucj = (UserCapabilityJunction) ((DAO) x.get("userCapabilityJunctionDAO"))
      .find(AND(
          getAssociationPredicate_(x, null),
          IN(UserCapabilityJunction.TARGET_ID, junctions),
          EQ(UserCapabilityJunction.STATUS, CapabilityJunctionStatus.GRANTED)
        )
      );

    return ucj != null;
  }

  // see documentation in CrunchService interface
  public boolean hasPreconditionsMet(X sessionX, String capabilityId) {
    // Return false if capability does not exist or is not available
    var capabilityDAO = ((DAO) sessionX.get("capabilityDAO")).inX(sessionX);
    Capability cap = (Capability) capabilityDAO.find(capabilityId);
    if ( cap == null ||  cap.getLifecycleState() != foam.core.auth.LifecycleState.ACTIVE ) return false;

    // TODO: use MapSink to simplify/optimize this code
    var preconditions = Arrays.stream(((CapabilityCapabilityJunction[]) ((ArraySink) ((DAO) sessionX.get("prerequisiteCapabilityJunctionDAO"))
      .inX(sessionX)
      .where(AND(
        EQ(CapabilityCapabilityJunction.SOURCE_ID, capabilityId),
        EQ(CapabilityCapabilityJunction.PRECONDITION, true)
      ))
      .select(new ArraySink())).getArray()
      .toArray(new CapabilityCapabilityJunction[0])))
      .map(CapabilityCapabilityJunction::getTargetId).toArray(String[]::new);

    for ( String preconditionId : preconditions ) {
      // Return false if capability does not exist or is not available
      Capability precondition = (Capability) capabilityDAO.find(preconditionId);
      if ( precondition == null || precondition.getLifecycleState() != foam.core.auth.LifecycleState.ACTIVE ) return false;
      var ucj = getJunction(sessionX, preconditionId);
      if ( ucj.getStatus() != CapabilityJunctionStatus.GRANTED ) return false;
    }

    return true;
  }

  // see documentation in CrunchService interface
  public ArraySink getEntryCapabilities(X x) {
    var sink = new ArraySink();
    var proxySink = new ProxySink(x, sink) {
      @Override
      public void put(Object o, Detachable sub) {
        var cap = (Capability) o;
        if ( ! cap.getVisibilityPredicate().f(x) || ! hasPreconditionsMet(x, cap.getId()) ) {
          return;
        }
        getDelegate().put(o, sub);
      }
    };

    var capabilityDAO = ((DAO) x.get("capabilityDAO")).inX(x);
    capabilityDAO.select(proxySink);
    return sink;
  }

  public UserCapabilityJunction[] getAllJunctionsForUser(X x) {
    Predicate associationPredicate = getAssociationPredicate_(x, null);
    DAO userCapabilityJunctionDAO = (DAO) x.get("userCapabilityJunctionDAO");
    ArraySink arraySink = (ArraySink) userCapabilityJunctionDAO
      .where(associationPredicate)
      .select(new ArraySink());
    return (UserCapabilityJunction[]) arraySink.getArray().toArray(new UserCapabilityJunction[0]);
  }

  public UserCapabilityJunction getJunctionForSubject(
    X x, String capabilityId, Subject subject
  ) {
    // Sudo as the given subject when the user in the current subject and the
    // given subject are different. Throws exception if the user doesn't have
    // permission update user context for sudo-ing.
    var currentSubject = (Subject) x.get("subject");
    if ( ! currentSubject.isUserInSubject(subject.getUser().getId()) ) {
      AuthService auth = (AuthService) x.get("auth");
      if ( auth.check(x, "service.crunchService.updateUserContext") ) {
        x = Auth.sudo(x, subject.getUser(), subject.getRealUser());
      } else throw new AuthorizationException("You don't have permission to check for UCJs");
    }

    Predicate targetPredicate = EQ(UserCapabilityJunction.TARGET_ID, capabilityId);
    Predicate lifecycleStateActive = EQ(UserCapabilityJunction.LIFECYCLE_STATE, ACTIVE);
    try {
      DAO userCapabilityJunctionDAO = (DAO) x.get("userCapabilityJunctionDAO");

      Predicate associationPredicate = getAssociationPredicate_(x, capabilityId);

      // Check if a ucj implies the subject.realUser has this permission in relation to the user
      var ucj = (UserCapabilityJunction)
        userCapabilityJunctionDAO.find(AND(lifecycleStateActive, associationPredicate, targetPredicate));
      if ( ucj == null ) {
        ucj = buildAssociatedUCJ(x, capabilityId, (Subject) x.get("subject"));
      } else {
        ucj = (UserCapabilityJunction) ucj.fclone();
      }

      return ucj;
    } catch ( Exception e ) {
      Logger logger = (Logger) x.get("logger");
      logger.error("getJunction", capabilityId, e);

      // On failure, report that the capability is available
      var ucj = buildAssociatedUCJ(x, capabilityId, (Subject) x.get("subject"));
      return ucj;
    }
  }

  public UserCapabilityJunction updateJunctionDirectly(X x, String capabilityId, FObject data) {
    Subject subject = (Subject) x.get("subject");
    UserCapabilityJunction ucj = this.getJunction(x, capabilityId);

    if ( ucj.getStatus() == AVAILABLE ) {
      ucj.setStatus(ACTION_REQUIRED);
    }

    if ( data != null ) {
      // Use existing data if it exists
      FObject existingData = ucj.getData();
      if ( existingData != null ) {
        existingData.copyFrom(data);
        data = existingData;
      }

      ucj.setData(data);
    }

    ucj.setLastUpdatedRealUser(subject.getRealUser().getId());

    DAO bareUserCapabilityJunctionDAO = (DAO) x.get("userCapabilityJunctionDAO");
    return (UserCapabilityJunction) bareUserCapabilityJunctionDAO.inX(x).put(ucj);
  }

  public UserCapabilityJunction updateJunction(
    X x, String capabilityId, FObject data,
    CapabilityJunctionStatus status
  ) {
    Subject subject = (Subject) x.get("subject");
    UserCapabilityJunction ucj = this.getJunction(x, capabilityId);

    if ( ucj.getStatus() == AVAILABLE && status == null ) {
      ucj.setStatus(ACTION_REQUIRED);
    }

    if ( data != null ) {
      ucj.setData(data);
    }
    if ( status != null ) {
      ucj.setStatus(status);
    }

    ucj.setLastUpdatedRealUser(subject.getRealUser().getId());
    DAO userCapabilityJunctionDAO = (DAO) x.get("userCapabilityJunctionDAO");
    return (UserCapabilityJunction) userCapabilityJunctionDAO.inX(x).put(ucj);
  }

  //TODO: Needs to be refactored once Subject is serializable
  public UserCapabilityJunction updateJunctionFor(
    X x, String capabilityId, FObject data,
    CapabilityJunctionStatus status, User effectiveUser, User user
  ) {
    AuthService auth = (AuthService) x.get("auth");
    if ( auth.check(x, "service.crunchService.updateUserContext") ) {
      x = Auth.sudo(x, effectiveUser, user);
    }
    return this.updateUserJunction(x, (Subject) x.get("subject"), capabilityId, data, status);
  }

  public UserCapabilityJunction updateUserJunction(
    X x, Subject subject, String capabilityId, FObject data,
    CapabilityJunctionStatus status
  ) {
    UserCapabilityJunction ucj = this.getJunctionForSubject(
      x, capabilityId, subject);

    if ( data != null ) {
      ucj.setData(data);
    }
    if ( status != null ) {
      ucj.setStatus(status);
    }
    AuthService auth = (AuthService) x.get("auth");
    if ( auth.check(x, "service.crunchService.updateUserContext") ) {
      x = Auth.sudo(x, subject.getUser(), subject.getRealUser());
    }
    DAO userCapabilityJunctionDAO = (DAO) x.get("userCapabilityJunctionDAO");
    return (UserCapabilityJunction) userCapabilityJunctionDAO.inX(x).put(ucj);
  }

  public UserCapabilityJunction buildAssociatedUCJ(
    X x, String capabilityId, Subject subject
  ) {
    // Need Capability to associate UCJ correctly
    DAO capabilityDAO = (DAO) x.get("capabilityDAO");

    // If the subject in context doesn't have the capability available, we
    // should act as though it doesn't exist; this is why inX is here.
    Capability cap = (Capability) capabilityDAO.inX(x).find(capabilityId);
    if ( cap == null ) {
      throw new RuntimeException(String.format("Capability not found %s", capabilityId));
    }
    if ( cap.getLifecycleState() != foam.core.auth.LifecycleState.ACTIVE ) {
      throw new RuntimeException(String.format("Capability not available %s", capabilityId));
    }
    AssociatedEntity associatedEntity = cap.getAssociatedEntity();
    boolean isAssociation = associatedEntity == AssociatedEntity.ACTING_USER;
    User associatedUser = associatedEntity == AssociatedEntity.USER
      ? subject.getUser()
      : subject.getRealUser()
      ;
    // Setup default data
    FObject payload = null;
    try {
      payload = cap.getOf() != null ? (FObject) cap.getOf().newInstance() : null;
    } catch ( Exception ex ) {
      throw new RuntimeException("UCJ payload default setup ERROR: " + ex.getMessage(), ex);
    }
    var ucj = isAssociation
      ? new AgentCapabilityJunction.Builder(x)
        .setSourceId(associatedUser.getId())
        .setTargetId(capabilityId)
        .setEffectiveUser(subject.getUser().getId())
        .build()
      : new UserCapabilityJunction.Builder(x)
        .setSourceId(associatedUser.getId())
        .setTargetId(capabilityId)
        .build()
      ;
    ucj.setStatus(CapabilityJunctionStatus.AVAILABLE);
    ucj.setData(payload);
    return ucj;
  }

  public void maybeIntercept(X x, String[] capabilityOptions) {
    if ( capabilityOptions.length < 1 ) {
      Logger logger = (Logger) x.get("logger");
      logger.warning("crunchService.maybeIntercept() performed with empty list");
      return;
    }

    // Check that at least one capability option is satisfied
    boolean satisfied = false;
    for ( String capId : capabilityOptions ) {
      UserCapabilityJunction ucj = this.getJunction(x, capId);
      if ( ucj != null && ucj.getStatus() == CapabilityJunctionStatus.GRANTED ) {
        satisfied = true;
        break;
      }
    }

    // Throw a capability intercept if none were satisfied
    if ( ! satisfied ) {
      CapabilityIntercept ex = new CapabilityIntercept(
        "Missing a required capability."
      );
      for ( String capId : capabilityOptions ) {
        ex.addCapabilityId(capId);
      }
      throw ex;
    }
  }

  public boolean isRenewable(X x, String capabilityId) {
    return isRenewable_(x, capabilityId, true);
  }

  public boolean isRenewable_(X x, String capabilityId, boolean firstCall) {
    DAO capabilityDAO = (DAO) x.get("capabilityDAO");
    CrunchService crunchService = (CrunchService) x.get("crunchService");
    Capability capability = (Capability) capabilityDAO.find(capabilityId);
    UserCapabilityJunction ucj = crunchService.getJunction(x, capabilityId);

    if ( capability == null || capability.getLifecycleState() != foam.core.auth.LifecycleState.ACTIVE ) return false;
    // if topLevel capability.isInternalCapability then returns capRenewability
    // if a preReq capability.isInternalCapability then that capability renewablity is ignored
    if ( ! firstCall && capability.getIsInternalCapability() ) return false;
    if ( ucj != null && ucj.getStatus() == CapabilityJunctionStatus.GRANTED && ucj.getIsRenewable() ) return true;

    var prereqs = getPrereqs(x, capabilityId, ucj);
    if ( prereqs != null ) {
      for ( var capId : prereqs ) {
        if ( isRenewable_(x, capId.toString(), false)  ) return true;
      }
    }
    return false;
  }

  public void createApprovalRequest(X x, String rootCapability) {
    var subject = (Subject) x.get("subject");
    Random r = ThreadLocalRandom.current();
    var uuid = new UUID(r.nextLong(), r.nextLong()).toString();
    var ucjReference = (Nary) AND(
      EQ(UserCapabilityJunction.SOURCE_ID, subject.getRealUser().getId()),
      EQ(UserCapabilityJunction.TARGET_ID, rootCapability)
    );
    if ( subject.getRealUser().getId() != subject.getUser().getId() ) {
      ucjReference.setArgs(new Predicate[] {
        ucjReference.getArgs()[0],
        ucjReference.getArgs()[1],
        EQ(AgentCapabilityJunction.EFFECTIVE_USER, subject.getUser().getId())
      });
    }

    // Replace capability IDs with approvable IDs
    var i = 0;
    var approvableIds = new ArrayList<String>();
    for ( Object capability : getCapabilityPath(x, rootCapability, false, false) ) {
      var capabilityId = ((Capability) capability).getId();
      var ucj = getJunction(x, capabilityId);
      if ( ucj == null ) continue;
      var approvable = (Approvable) ((DAO) x.get("approvableDAO")).find(EQ(
        Approvable.OBJ_ID, ucj.getId()
      ));
      if ( approvable == null ) continue;
      approvableIds.add(approvable.getId());
      i++;
    }

    var approvable = new UCJUpdateApprovable.Builder(x)
      .setId(uuid)
      .setAssociatedTopLevelUCJ(ucjReference)
      .setApprovableIds(approvableIds.toArray(String[]::new))
      .build();

    ((DAO) x.get("approvableDAO")).put(approvable);

    var approvalRequest = new ApprovalRequest.Builder(x)
      .setDaoKey("approvableDAO")
      .setObjId(uuid)
      .setOperation(Operation.UPDATE)
      .setCreatedFor(subject.getUser().getId())
      // TODO: How can we make this configurable?
      .setGroup(subject.getUser().getSpid() + "-fraud-ops")
      .setClassification("update-on-active-ucj")
      .build();

    ((DAO) x.get("approvalRequestDAO")).put(approvalRequest);
  }

  public boolean maybeReopen(X x, String capabilityId) {
    DAO capabilityDAO = (DAO) x.get("capabilityDAO");
    CrunchService crunchService = (CrunchService) x.get("crunchService");

    Capability capability = (Capability) capabilityDAO.find(capabilityId);
    UserCapabilityJunction ucj = crunchService.getJunction(x, capabilityId);
    return capability.maybeReopen(x, ucj);
  }

  public WizardState getWizardState(X x, String capabilityId) {
    var subject = (Subject) x.get("subject");
    return getWizardStateFor_(x, subject, capabilityId);
  }

  private WizardState getWizardStateFor_(X x, Subject s, String capabilityId) {
    var wizardStateDAO = (DAO) x.get("wizardStateDAO");

    var wizardState = new WizardState.Builder(x)
      .setRealUser(s.getRealUser().getId())
      .setEffectiveUser(s.getUser().getId())
      .setCapability(capabilityId)
      .build();

    var wizardStateFind = wizardStateDAO.find(wizardState);

    if ( wizardStateFind != null ) return (WizardState) wizardStateFind;

    wizardState.setIgnoreList(getGrantedFor_(x, s, capabilityId));
    wizardStateDAO.put(wizardState);
    return wizardState;
  }

  private String[] getGrantedFor_(X x, Subject s, String capabilityId) {
    x = x.put("subject", s);
    var capsOrLists = getCapabilityPath(x, capabilityId, false, true);
    var granted = (List<String>) new ArrayList<String>();

    var grantedStatuses = new CapabilityJunctionStatus[] {
      CapabilityJunctionStatus.GRANTED,
      CapabilityJunctionStatus.PENDING,
      CapabilityJunctionStatus.APPROVED,
    };

    for ( Object obj : capsOrLists ) {
      Capability cap;
      boolean isPrereqAware = false;
      if ( obj instanceof List ) {
        isPrereqAware = true;
        var list = (List) obj;
        cap = (Capability) list.get(list.size() - 1);
      } else {
        cap = (Capability) obj;
      }

      try {
        var ucj = getJunction(x, cap.getId());
        if ( IN(UserCapabilityJunction.STATUS, grantedStatuses).f(ucj) ) {
          // if a minmax capability is in GRANTED status, its prerequisites should also be added
          // as a part of granted list, so the wizrd will know to ignore the prerequisites
          if ( isPrereqAware ) {
            for ( var c : (List) obj ) {
              granted.add(((Capability) c).getId());
            }
          }
          else granted.add(cap.getId());
        }
      } catch ( RuntimeException e ) {
        // This happens if getJunction was called with an unavailabile
        // capability, which is fine here.
      }
    }

    return granted.toArray(new String[0]);
  }

  private Predicate getAssociationPredicate_(X x, String capabilityId) {
    Subject subject = (Subject) x.get("subject");

    User user     = subject.getUser();
    User realUser = subject.getRealUser();

    Predicate acjPredicate = INSTANCE_OF(AgentCapabilityJunction.class);

    // Consider the capability that is being referenced,
    // and assign correct predicate
    if ( capabilityId != null ) {
      DAO capabilityDAO = (DAO) x.get("capabilityDAO");
      Capability cap = (Capability) capabilityDAO.inX(x).find(capabilityId);
      if ( cap == null || cap.getLifecycleState() != foam.core.auth.LifecycleState.ACTIVE ) {
        throw new RuntimeException(String.format("Capability not found, find %s, subject.user(ucj.effectiveUser): %s, subject.realUser(ucj.sourceId): %s", capabilityId, user.getId(), realUser.getId()));
      }
      if ( cap.getAssociatedEntity() == AssociatedEntity.USER )
        return EQ(UserCapabilityJunction.SOURCE_ID, user.getId());
      if ( cap.getAssociatedEntity() == AssociatedEntity.REAL_USER )
        return EQ(UserCapabilityJunction.SOURCE_ID, realUser.getId());
      if ( cap.getAssociatedEntity() == AssociatedEntity.ACTING_USER )
        return AND(
                   acjPredicate,
                   // Check if a ucj implies the subject.realUser has this permission in relation to the user
                   EQ(UserCapabilityJunction.SOURCE_ID, realUser.getId()),
                   EQ(AgentCapabilityJunction.EFFECTIVE_USER, user.getId())
                   );
    }

    // default search result - however updates need to be more specific
    Predicate result = OR(
      AND(
        NOT(acjPredicate),
        ( user != realUser )
          // Check if a ucj implies the subject.user has this permission
          ? OR(
              EQ(UserCapabilityJunction.SOURCE_ID, realUser.getId()),
              EQ(UserCapabilityJunction.SOURCE_ID, user.getId())
            )
          // Check if a ucj implies the subject.realUser has this permission
          : EQ(UserCapabilityJunction.SOURCE_ID, realUser.getId())
      ),
      AND(
        acjPredicate,
        // Check if a ucj implies the subject.realUser has this permission in relation to the user
        EQ(UserCapabilityJunction.SOURCE_ID, realUser.getId()),
        EQ(AgentCapabilityJunction.EFFECTIVE_USER, user.getId())
      )
    );

    return result;
  }

  public UserCapabilityJunction resetJunctionData(X x, String junctionId) {
    var dao = (DAO) x.get("userCapabilityJunctionDAO");
    var ucj = (UserCapabilityJunction) dao.inX(x).find(junctionId);

    if ( ucj != null && ucj.getData() != null ) {
      var auth = (AuthService) x.get("auth");
      if (auth.check(x, "usercapabilityjunction.action.reset")) {
        ucj = (UserCapabilityJunction) ucj.fclone();

        ucj.setData(null);
        ucj.setStatus(ACTION_REQUIRED);
        return (UserCapabilityJunction) dao.put(ucj);
      }
    }
    return null;
  }
}
