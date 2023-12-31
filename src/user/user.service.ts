import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { validate } from 'class-validator';
import * as jwt from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { SECRET } from '../config';
import { CreateUserDto, LoginUserDto, UpdateUserDto } from './dto';
import { UserEntity } from './user.entity';
import { UserRO } from './user.interface';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  private buildUserRO(user: UserEntity) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      token: this.generateJWT(user),
      image: user.image,
    };
  }

  public generateJWT(user) {
    const today = new Date();
    const exp = new Date(today);
    exp.setDate(today.getDate() + 60);

    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        exp: exp.getTime() / 1000,
      },
      SECRET,
    );
  }

  async findAll(): Promise<UserEntity[]> {
    return await this.userRepository.find();
  }

  async findOne({ email, password }: LoginUserDto): Promise<UserEntity> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      return null;
    }

    if (await argon2.verify(user.password, password)) return user;

    return null;
  }

  async findById(id: number): Promise<UserRO> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      const errors = { User: 'not found' };
      throw new HttpException({ errors }, 401);
    }

    return this.buildUserRO(user);
  }

  async findByEmail(email: string): Promise<UserRO> {
    const user = await this.userRepository.findOne({ where: { email } });
    return this.buildUserRO(user);
  }

  async update(id: number, dto: UpdateUserDto): Promise<UserEntity> {
    const toUpdate = await this.userRepository.findOne({ where: { id } });
    delete toUpdate.password;
    delete toUpdate.favorites;

    const updated = { ...toUpdate, ...dto };
    return await this.userRepository.save(updated);
  }

  async create(dto: CreateUserDto): Promise<UserRO> {
    // check uniqueness of username/email
    const { username, email, password } = dto;
    const qb = this.userRepository
      .createQueryBuilder('user')
      .where('user.username = :username', { username })
      .orWhere('user.email = :email', { email });

    const user = await qb.getOne();

    if (user) {
      const errors = { username: 'Username and email must be unique.' };
      throw new HttpException(
        { message: 'Input data validation failed', errors },
        HttpStatus.BAD_REQUEST,
      );
    }

    // create new user
    const newUser = new UserEntity();
    newUser.username = username;
    newUser.email = email;
    newUser.password = password;
    newUser.articles = [];

    const errors = await validate(newUser);
    if (errors.length > 0) {
      const _errors = { username: 'Userinput is not valid.' };
      throw new HttpException(
        { message: 'Input data validation failed', _errors },
        HttpStatus.BAD_REQUEST,
      );
    } else {
      const savedUser = await this.userRepository.save(newUser);
      return this.buildUserRO(savedUser);
    }
  }
}
