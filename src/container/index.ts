import {container} from "tsyringe";
import {UserService} from "../business/services/UserService";
import {IUserRepository} from "../data/interfaces/IUserRepository";
import {UserRepository} from "../data/repositories/UserRepository";

container.register("UserService", { useClass: UserService });

container.register<IUserRepository>("IUserRepository", {
    useClass: UserRepository,
});