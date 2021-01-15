import { removeSourceData, updateSourceData } from '../util/source-data';
import { ADMS } from '../util/rdflib';
import { GRAPHS, SemanticForm, STATES } from '../entities/semantic-form';

export class FormManagementService {

  constructor(versionService) {
    this.versionService = versionService;
  }

  async get(uuid) {
    return await new SemanticForm(this.versionService).init(uuid);
  }

  async delete(uuid) {
    const semanticForm = await this.get(uuid);
    if (!semanticForm.submitted) {
      await removeSourceData(semanticForm.graph, {graph: GRAPHS.source});
    } else {
      throw {
        status: 304,
        message: `Could not delete the application-form for UUID "${uuid}" as it has already been submitted.`,
      };
    }
  }

  async update(uuid, delta) {
    const semanticForm = await this.get(uuid);
    if (!semanticForm.submitted) {
      await updateSourceData(delta);
    } else {
      throw {
        status: 304,
        message: `Could not update the application-form for UUID "${uuid}" as it has already been submitted.`,
      };
    }
  }

  async submit(uuid) {
    const semanticForm = await this.get(uuid);
    if (!semanticForm.submitted) {
      if (semanticForm.isValid) {
        // NOTE: model-mapping
        try {
          // TODO
         //  const mapper_config = require(uriToPath(`${semanticForm.versionURI}/${FILES.mapper}`));
         //  const model = await new ModelMapper(semanticForm.uri, mapper_config).map();
         //  const additions = model.toNT();
         //  await updateSourceData({additions});
        } catch (e) {
          console.log('Form harvest did not occur, possibly no configuration given?');
          console.log(e);
        }
        // NOTE: if only when "post-processing" was successfully, we update the state to "submitted"
        // TODO need to find a better way off updating and keeping the local store in sync (maybe using the ForkingStore?)
        const additions = `<${semanticForm.uri}> ${ADMS('status')} <${STATES.sent}> .`;
        const removals = `<${semanticForm.uri}> ${ADMS('status')} <${STATES.concept}> .`;
        await updateSourceData({additions, removals});
      } else {
        throw {
          status: 422,
          message: `Could not submit the application-form for UUID "${uuid}" as not all conditions were met.`,
        };
      }
    } else {
      throw {
        status: 304,
        message: `Could not submit the application-form for UUID "${uuid}" as it has already been submitted.`,
      };
    }
  }
}