import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class FollowsEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  followerId: number;

  @Column()
  followingId: number;
}
